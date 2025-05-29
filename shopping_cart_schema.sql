-- shopping_cart_schema.sql
-- Database schema for Shopping Cart functionality
-- Database System: PostgreSQL

-- Ensure UUID generation extension is available (already in phase1_schema.sql, but good for standalone)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------
--      SHOPPING CART MODULE       --
-------------------------------------

-- Table for storing shopping carts
CREATE TABLE shopping_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable for guest carts; app layer associates guest session with cart id
    -- ON DELETE SET NULL for user_id: if a user is deleted, the cart might persist as an anonymous/guest cart or be handled by cleanup logic.
    -- Alternatively, ON DELETE CASCADE if carts should be deleted with users. SET NULL is safer for not losing cart data immediately.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE shopping_carts IS 'Stores shopping carts, can be associated with a registered user or a guest session (managed by application layer).';
COMMENT ON COLUMN shopping_carts.user_id IS 'Foreign key to the users table. NULL if the cart belongs to a guest.';

-- Table for storing items within a shopping cart
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE, -- If a cart is deleted, its items are also deleted.
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- If a product is deleted, remove it from carts. Consider implications.
    -- Alternative for product_id ON DELETE: SET NULL and handle it in application logic (e.g., notify user item is no longer available). CASCADE is simpler for MVP.
    quantity INT NOT NULL CHECK (quantity > 0),
    price_at_addition DECIMAL(10, 2) NOT NULL, -- Price of the product when it was added to the cart
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- If items can be updated (e.g. quantity change directly on item row, not just re-adding)

    CONSTRAINT uq_cart_item_product UNIQUE (cart_id, product_id) -- Ensures a product appears only once per cart; update quantity instead.
);

COMMENT ON TABLE cart_items IS 'Stores items within a shopping cart, linking to products and recording quantity and price at time of addition.';
COMMENT ON COLUMN cart_items.cart_id IS 'Foreign key to the shopping_carts table.';
COMMENT ON COLUMN cart_items.product_id IS 'Foreign key to the products table.';
COMMENT ON COLUMN cart_items.quantity IS 'Quantity of the product in the cart. Must be greater than 0.';
COMMENT ON COLUMN cart_items.price_at_addition IS 'The price of the product at the time it was added to the cart.';
COMMENT ON CONSTRAINT uq_cart_item_product ON cart_items IS 'Prevents adding the same product as multiple line items in the same cart; quantity should be updated on existing item.';

-- Indexes
CREATE INDEX idx_shopping_carts_user_id ON shopping_carts(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Reusing or defining the trigger function for 'updated_at'
-- This function should ideally be defined once in the database.
-- If not already created by phase1_schema.sql or another script, define it:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
    CREATE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Apply the trigger to shopping_carts
CREATE TRIGGER set_timestamp_shopping_carts
BEFORE UPDATE ON shopping_carts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- If cart_items rows were to be updated frequently (e.g. quantity changes directly on the item row)
-- you might add an updated_at column and trigger to cart_items as well.
-- For MVP, quantity changes might be handled by deleting and re-adding, or service layer updates added_at if needed.
-- Let's add updated_at to cart_items for completeness if quantity updates become direct.
ALTER TABLE cart_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE TRIGGER set_timestamp_cart_items
BEFORE UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


COMMIT;

-- Example Considerations for Guest Cart Management (Application Layer):
-- 1. When a guest adds an item to the cart for the first time:
--    - Application generates a unique session identifier (if not already present).
--    - API creates a new record in `shopping_carts` with `user_id` as NULL.
--    - API stores this new `cart_id` in the guest's session (e.g., JWT custom claim for guest, or browser session/localStorage).
-- 2. Subsequent cart operations for the guest use this `cart_id`.
-- 3. When the guest logs in or registers:
--    - Application checks if the guest session had a `cart_id`.
--    - If yes, and the logged-in user has an existing cart, merge the guest cart items into the user's cart.
--      - Update `user_id` on the guest's cart to associate it with the user.
--      - Or, move items from guest cart to user's cart, then deactivate/delete guest cart.
--    - If user has no cart, associate the guest's cart with the `user_id`.
```
