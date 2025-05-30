-- server/src/modules/discounts/sql/coupon.sql

-- Table to store specific coupon codes, which are instances of a Discount
CREATE TABLE Coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_code VARCHAR(100) NOT NULL UNIQUE, -- The actual code string
    discount_id UUID NOT NULL REFERENCES Discounts(id) ON DELETE CASCADE, -- Link to the parent discount rule
    description TEXT, -- Optional: specific description for this coupon code

    max_uses_per_user INTEGER NULL CHECK (max_uses_per_user IS NULL OR max_uses_per_user > 0),
    max_uses_total INTEGER NULL CHECK (max_uses_total IS NULL OR max_uses_total > 0),
    current_uses_total INTEGER NOT NULL DEFAULT 0,

    start_date TIMESTAMPTZ NULL, -- Optional: can override Discount's start_date
    end_date TIMESTAMPTZ NULL,   -- Optional: can override Discount's end_date

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID, -- REFERENCES Users(id) ON DELETE SET NULL,
    updated_by UUID, -- REFERENCES Users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_coupon_code_format CHECK (coupon_code ~ '^[A-Z0-9_-]+$'), -- Example: Alphanumeric, uppercase, underscore, hyphen
    CONSTRAINT chk_coupon_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- Table to track each time a coupon is successfully used by a user in an order
CREATE TABLE CouponUsage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES Coupons(id) ON DELETE RESTRICT, -- Prevent deleting a coupon that has been used
    user_id UUID NOT NULL, -- REFERENCES Users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL UNIQUE, -- REFERENCES Orders(id) ON DELETE CASCADE, -- Assuming Orders table exists
    discount_amount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign Key Comments
-- ALTER TABLE Coupons ADD CONSTRAINT fk_coupons_created_by FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL;
-- ALTER TABLE Coupons ADD CONSTRAINT fk_coupons_updated_by FOREIGN KEY (updated_by) REFERENCES Users(id) ON DELETE SET NULL;
-- ALTER TABLE CouponUsage ADD CONSTRAINT fk_couponusage_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE;
-- ALTER TABLE CouponUsage ADD CONSTRAINT fk_couponusage_order FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE;


-- Indexes
CREATE INDEX idx_coupons_discount_id ON Coupons(discount_id);
CREATE INDEX idx_coupons_is_active_dates ON Coupons(is_active, start_date, end_date);
-- UNIQUE constraint on coupon_code already creates an index.

CREATE INDEX idx_couponusage_coupon_id ON CouponUsage(coupon_id);
CREATE INDEX idx_couponusage_user_id ON CouponUsage(user_id);
-- UNIQUE constraint on order_id already creates an index.


-- Trigger to update updated_at timestamp for Coupons
-- Assuming trigger_set_timestamp() function from previous modules (e.g., assessment.sql or discount.sql)
CREATE TRIGGER set_coupon_updated_at_timestamp
BEFORE UPDATE ON Coupons
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
