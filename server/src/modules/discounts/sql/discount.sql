-- server/src/modules/discounts/sql/discount.sql

-- Table to store general discount rules/campaigns
CREATE TABLE Discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    value DECIMAL(10, 2) NOT NULL CHECK (value > 0),
    applicable_scope VARCHAR(50) NOT NULL DEFAULT 'all_courses'
        CHECK (applicable_scope IN (
            'all_courses',
            'specific_courses',
            'specific_categories'
            -- Future: 'all_products', 'specific_products'
        )),
    min_purchase_amount DECIMAL(10, 2) NULL CHECK (min_purchase_amount IS NULL OR min_purchase_amount >= 0),
    start_date TIMESTAMPTZ NULL,
    end_date TIMESTAMPTZ NULL,
    max_uses_total INTEGER NULL CHECK (max_uses_total IS NULL OR max_uses_total > 0),
    current_uses_total INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID, -- REFERENCES Users(id) ON DELETE SET NULL, -- Assuming Users table exists
    updated_by UUID, -- REFERENCES Users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_discount_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
    CONSTRAINT chk_discount_value_for_percentage CHECK (discount_type != 'percentage' OR (value > 0 AND value <= 100))
);

-- Join table to specify which entities (courses, categories) a discount applies to
CREATE TABLE DiscountApplicability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_id UUID NOT NULL REFERENCES Discounts(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('course', 'category')),
    entity_id UUID NOT NULL, -- This would FK to Courses(id) or Categories(id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (discount_id, entity_type, entity_id)
);

-- Foreign Key Comments (to be uncommented when Users, Courses, Categories tables are confirmed)
-- ALTER TABLE Discounts ADD CONSTRAINT fk_discounts_created_by FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE SET NULL;
-- ALTER TABLE Discounts ADD CONSTRAINT fk_discounts_updated_by FOREIGN KEY (updated_by) REFERENCES Users(id) ON DELETE SET NULL;
-- Note: FK for DiscountApplicability.entity_id needs application-level logic or complex DB setup if referencing multiple tables.

-- Indexes
CREATE INDEX idx_discounts_active_dates ON Discounts(is_active, start_date, end_date);
CREATE INDEX idx_discounts_type ON Discounts(discount_type);
CREATE INDEX idx_discounts_scope ON Discounts(applicable_scope);
CREATE INDEX idx_discountapplicability_discount_id ON DiscountApplicability(discount_id);
CREATE INDEX idx_discountapplicability_entity ON DiscountApplicability(entity_type, entity_id);

-- Trigger to update updated_at timestamp for Discounts
-- Assuming trigger_set_timestamp() function from previous modules (e.g., assessment.sql)
CREATE TRIGGER set_discount_updated_at_timestamp
BEFORE UPDATE ON Discounts
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
