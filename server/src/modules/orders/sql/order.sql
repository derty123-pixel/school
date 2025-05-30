-- server/src/modules/orders/sql/order.sql

CREATE TABLE Orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- REFERENCES Users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' -- e.g., pending, paid, shipped, delivered, cancelled
        CHECK (status IN ('pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),

    -- Address details (can be normalized into an Addresses table and linked)
    shipping_address_line1 TEXT,
    shipping_address_line2 TEXT,
    shipping_city VARCHAR(100),
    shipping_state_province VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country_code VARCHAR(2), -- ISO 3166-1 alpha-2

    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city VARCHAR(100),
    billing_state_province VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country_code VARCHAR(2),

    -- Financials
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0), -- Sum of (item price * quantity) before discounts and taxes
    discount_amount DECIMAL(10, 2) DEFAULT 0.00 CHECK (discount_amount >= 0),
    shipping_cost DECIMAL(10, 2) DEFAULT 0.00 CHECK (shipping_cost >= 0),
    tax_amount DECIMAL(10, 2) DEFAULT 0.00 CHECK (tax_amount >= 0),
    final_total DECIMAL(10, 2) NOT NULL CHECK (final_total >= 0),

    coupon_id UUID NULL REFERENCES Coupons(id) ON DELETE SET NULL, -- Coupon used for this order

    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    transaction_id VARCHAR(255) NULL, -- From payment gateway

    notes TEXT, -- Customer notes or internal notes

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE OrderItems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES Orders(id) ON DELETE CASCADE,
    -- Assuming these items are courses for now
    course_id UUID NOT NULL, -- REFERENCES Courses(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(10, 2) NOT NULL CHECK (price_at_purchase >= 0), -- Price of the item when the order was placed
    title_at_purchase VARCHAR(255), -- Store title at purchase time, as course title might change

    -- If items can have their own discounts or if discount is applied line-item wise
    -- line_item_discount_amount DECIMAL(10, 2) DEFAULT 0.00,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_user_id ON Orders(user_id);
CREATE INDEX idx_orders_status ON Orders(status);
CREATE INDEX idx_orders_payment_status ON Orders(payment_status);
CREATE INDEX idx_orders_coupon_id ON Orders(coupon_id);
CREATE INDEX idx_orderitems_order_id ON OrderItems(order_id);
CREATE INDEX idx_orderitems_course_id ON OrderItems(course_id);

-- Triggers for updated_at
-- Assuming trigger_set_timestamp() function from previous modules
CREATE TRIGGER set_order_updated_at_timestamp
BEFORE UPDATE ON Orders
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_orderitem_updated_at_timestamp
BEFORE UPDATE ON OrderItems
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- FK Comments
-- ALTER TABLE Orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES Users(id);
-- ALTER TABLE OrderItems ADD CONSTRAINT fk_orderitems_course FOREIGN KEY (course_id) REFERENCES Courses(id);
