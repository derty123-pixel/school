-- server/src/modules/inventory/sql/inventory.sql

-- Table to manage inventory for products (courses in this context)
CREATE TABLE ProductInventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- 'product_id' refers to 'course_id' from the 'Courses' table.
    -- UNIQUE constraint ensures one inventory record per course.
    product_id UUID NOT NULL UNIQUE, -- REFERENCES Courses(id) ON DELETE CASCADE, -- Assuming Courses table exists

    quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),

    stock_status VARCHAR(50) NOT NULL DEFAULT 'in_stock'
        CHECK (stock_status IN ('in_stock', 'out_of_stock', 'low_stock', 'discontinued')),

    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),

    low_stock_threshold INTEGER NULL CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),

    last_stock_update TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    version INTEGER NOT NULL DEFAULT 1, -- For optimistic locking

    -- This constraint might be too strict if quantity_available is decremented before reserved_quantity is fulfilled.
    -- Application logic should ensure reserved_quantity <= quantity_available before attempting to reserve.
    CONSTRAINT chk_inventory_reserved_not_greater_than_available CHECK (reserved_quantity <= quantity_available)
);

-- Foreign Key Comments
-- ALTER TABLE ProductInventory ADD CONSTRAINT fk_inventory_product_course FOREIGN KEY (product_id) REFERENCES Courses(id) ON DELETE CASCADE;

-- Indexes
-- UNIQUE constraint on product_id already creates an index.
CREATE INDEX idx_productinventory_stock_status ON ProductInventory(stock_status);

-- Trigger to update last_stock_update timestamp
-- This trigger will update 'last_stock_update' whenever 'quantity_available' or 'reserved_quantity' changes.
-- It assumes the trigger_set_timestamp() function exists and updates the 'updated_at' column by default.
-- We might need a more specific trigger or handle this in application logic if 'last_stock_update'
-- needs to be distinct from a generic 'updated_at'.
-- For now, let's assume 'last_stock_update' is set by the application or a modified trigger.
-- If using the existing trigger_set_timestamp for a generic 'updated_at' like field and renaming:
ALTER TABLE ProductInventory RENAME COLUMN last_stock_update TO updated_at;

CREATE TRIGGER set_productinventory_updated_at_timestamp
BEFORE UPDATE ON ProductInventory
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); -- Assumes trigger_set_timestamp() is created

-- Reset column name if it was temporarily changed for the trigger setup, if a dedicated update mechanism is preferred.
-- ALTER TABLE ProductInventory RENAME COLUMN updated_at TO last_stock_update;
-- In this case, the application would be responsible for setting last_stock_update explicitly.
-- For simplicity with current tools, we'll use the standard updated_at trigger and assume last_stock_update is this field.
-- So, the RENAME above is effectively permanent for this setup. Let's stick to last_stock_update and handle it in service.
-- Reverting the RENAME and will handle last_stock_update in service code.
ALTER TABLE ProductInventory RENAME COLUMN updated_at TO last_stock_update;
DROP TRIGGER IF EXISTS set_productinventory_updated_at_timestamp ON ProductInventory;
-- The application service will explicitly set last_stock_update.
-- The version column will be handled by application logic for optimistic locking.
