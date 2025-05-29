-- phase1_schema.sql
-- Initial database schema for User Management and Product Catalog modules
-- Database System: PostgreSQL

-- Enable UUID generation extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-------------------------------------
--      USER MANAGEMENT MODULE     --
-------------------------------------

-- Table for storing user roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'student', 'customer', 'instructor', 'admin'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Stores user roles, e.g., student, customer, instructor, admin.';
COMMENT ON COLUMN roles.role_name IS 'Unique name of the role.';

-- Table for storing user information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL, -- Store securely hashed passwords
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'Stores user account information.';
COMMENT ON COLUMN users.email IS 'Unique email address for login.';
COMMENT ON COLUMN users.hashed_password IS 'Stores securely hashed user passwords.';

-- Join table for mapping users to roles (many-to-many relationship)
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id), -- Composite primary key
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_roles IS 'Maps users to their roles. A user can have multiple roles.';

-- Indexes for User Management
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

---------------------------------------
--      PRODUCT CATALOG MODULE       --
---------------------------------------

-- Table for storing product categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL, -- For subcategories
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE product_categories IS 'Stores product categories and subcategories.';
COMMENT ON COLUMN product_categories.name IS 'Unique name of the category.';
COMMENT ON COLUMN product_categories.parent_category_id IS 'Reference to a parent category for hierarchical structure.';

-- Table for storing product information
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL, -- Stock Keeping Unit
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0), -- Price with 2 decimal places
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL, -- Product can exist without a category temporarily
    image_urls JSONB, -- Store an array of image URLs or structured image data
    -- Example: '[{"url": "path/to/image1.jpg", "alt_text": "Image 1"}, {"url": "path/to/image2.jpg", "alt_text": "Image 2"}]'
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE products IS 'Stores detailed information about products.';
COMMENT ON COLUMN products.sku IS 'Unique Stock Keeping Unit for product identification.';
COMMENT ON COLUMN products.price IS 'Price of the product, must be non-negative.';
COMMENT ON COLUMN products.category_id IS 'Foreign key linking to the product_categories table.';
COMMENT ON COLUMN products.image_urls IS 'JSONB field to store image URLs and related metadata (e.g., alt text).';

-- Table for managing product inventory
CREATE TABLE product_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE, -- Each product has one inventory record
    quantity_available INT NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    low_stock_threshold INT DEFAULT 10 CHECK (low_stock_threshold >= 0),
    last_restocked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE product_inventory IS 'Manages stock levels for products.';
COMMENT ON COLUMN product_inventory.product_id IS 'Foreign key linking to the products table; unique to ensure one inventory record per product.';
COMMENT ON COLUMN product_inventory.quantity_available IS 'Current stock quantity, must be non-negative.';
COMMENT ON COLUMN product_inventory.low_stock_threshold IS 'Threshold for low stock alerts.';

-- Indexes for Product Catalog
CREATE INDEX idx_product_categories_name ON product_categories(name);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name); -- For searching by product name
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_product_inventory_product_id ON product_inventory(product_id);

-- Trigger function to update 'updated_at' columns automatically
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to tables with 'updated_at'
CREATE TRIGGER set_timestamp_roles
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_product_categories
BEFORE UPDATE ON product_categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_products
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_product_inventory
BEFORE UPDATE ON product_inventory
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Default roles (optional, can be seeded by application logic)
-- INSERT INTO roles (role_name, description) VALUES ('student', 'Enrolled in courses');
-- INSERT INTO roles (role_name, description) VALUES ('customer', 'Purchases products');
-- INSERT INTO roles (role_name, description) VALUES ('instructor', 'Manages course content');
-- INSERT INTO roles (role_name, description) VALUES ('admin', 'Platform administrator');

COMMIT;
