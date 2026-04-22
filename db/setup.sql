-- ============================================================
-- Jupiter One USA — Database Setup Script
-- Run this in SSMS against your jupiteroneusa database
-- ============================================================

-- Create the database (run this once separately if needed)
-- CREATE DATABASE jupiteroneusa;
-- GO

USE jupiteroneusa;
GO

-- ── NSN CATALOG TABLE ────────────────────────────────────────
-- This is where the DLA/FEDLOG data gets imported
-- Each row = one NSN from the public government catalog
CREATE TABLE IF NOT EXISTS nsn_catalog (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    nsn             VARCHAR(20)   NOT NULL,   -- e.g. 1560-00-082-4545
    niin            VARCHAR(13),              -- last 9 digits of NSN
    fsg             VARCHAR(2),               -- Federal Supply Group (first 2)
    fsc             VARCHAR(4),               -- Federal Supply Class (first 4)
    item_name       VARCHAR(255),             -- e.g. PANEL ASSEMBLY, AIRCRAFT
    status          VARCHAR(20)  DEFAULT 'A', -- A=Active, I=Inactive
    ui              VARCHAR(10),              -- Unit of Issue e.g. EA, PK
    created_at      DATETIME     DEFAULT GETDATE()
);
GO

-- Index for fast search by NSN
CREATE INDEX idx_nsn ON nsn_catalog(nsn);
CREATE INDEX idx_niin ON nsn_catalog(niin);
CREATE INDEX idx_fsc ON nsn_catalog(fsc);
GO

-- ── MANUFACTURER PART NUMBERS TABLE ─────────────────────────
-- Each NSN can have multiple manufacturer part numbers (cross-reference)
CREATE TABLE nsn_parts (
    id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    nsn_id      BIGINT        NOT NULL REFERENCES nsn_catalog(id),
    nsn         VARCHAR(20)   NOT NULL,
    cage_code   VARCHAR(10),              -- Manufacturer CAGE code
    part_number VARCHAR(100),             -- Manufacturer part number
    created_at  DATETIME DEFAULT GETDATE()
);
GO

CREATE INDEX idx_part_number ON nsn_parts(part_number);
CREATE INDEX idx_cage_code ON nsn_parts(cage_code);
CREATE INDEX idx_nsn_parts_nsn ON nsn_parts(nsn);
GO

-- ── RFQ LEADS TABLE ──────────────────────────────────────────
-- Stores every quote request submitted through the website
CREATE TABLE rfq_leads (
    id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    -- Part info
    nsn             VARCHAR(20),
    part_number     VARCHAR(100),
    item_name       VARCHAR(255),
    quantity        INT           DEFAULT 1,
    -- Customer info
    full_name       VARCHAR(100)  NOT NULL,
    company         VARCHAR(150),
    email           VARCHAR(150)  NOT NULL,
    phone           VARCHAR(30),
    message         NVARCHAR(MAX),
    -- Internal tracking
    status          VARCHAR(30)   DEFAULT 'New',
    -- New, Contacted, Quoted, Won, Lost
    notes           NVARCHAR(MAX),
    quoted_price    DECIMAL(10,2),
    -- Metadata
    ip_address      VARCHAR(45),
    created_at      DATETIME      DEFAULT GETDATE(),
    updated_at      DATETIME      DEFAULT GETDATE()
);
GO

CREATE INDEX idx_rfq_status ON rfq_leads(status);
CREATE INDEX idx_rfq_email  ON rfq_leads(email);
CREATE INDEX idx_rfq_date   ON rfq_leads(created_at);
GO

-- ── FSG LOOKUP TABLE ─────────────────────────────────────────
CREATE TABLE fsg_lookup (
    fsg         VARCHAR(2)   PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    notes       NVARCHAR(MAX)
);
GO

-- Seed FSG data (top aerospace-relevant groups)
INSERT INTO fsg_lookup (fsg, title) VALUES
('15', 'Aircraft and Airframe Structural Components'),
('16', 'Aircraft Components and Accessories'),
('17', 'Aircraft Launching, Landing, and Ground Handling Equipment'),
('18', 'Space Vehicles'),
('19', 'Ships, Small Craft, Pontoons, and Floating Docks'),
('20', 'Ship and Marine Equipment'),
('28', 'Engines, Turbines, and Components'),
('29', 'Engine Accessories'),
('12', 'Fire Control Equipment'),
('13', 'Ammunition and Explosives'),
('23', 'Ground Effect Vehicles, Motor Vehicles, Trailers, and Cycles'),
('25', 'Vehicular Equipment Components'),
('26', 'Tires and Tubes'),
('30', 'Mechanical Power Transmission Equipment'),
('31', 'Bearings'),
('47', 'Pipe, Tubing, Hose, and Fittings'),
('53', 'Hardware and Abrasives'),
('59', 'Electrical and Electronic Equipment Components'),
('61', 'Electric Wire, and Power and Distribution Equipment'),
('66', 'Instruments and Laboratory Equipment');
GO

-- ── FSC LOOKUP TABLE ─────────────────────────────────────────
CREATE TABLE fsc_lookup (
    fsc         VARCHAR(4)   PRIMARY KEY,
    fsg         VARCHAR(2),
    title       VARCHAR(150) NOT NULL
);
GO

-- Seed common aerospace FSC codes
INSERT INTO fsc_lookup (fsc, fsg, title) VALUES
('1510', '15', 'Aircraft, Fixed Wing'),
('1520', '15', 'Aircraft, Rotary Wing'),
('1540', '15', 'Gliders'),
('1550', '15', 'Drones, Unmanned Aircraft'),
('1560', '15', 'Airframe Structural Components'),
('1610', '16', 'Aircraft Propellers and Components'),
('1615', '16', 'Helicopter Rotor Blades, Drive Mechanisms and Components'),
('1620', '16', 'Aircraft Landing Gear Components'),
('1630', '16', 'Aircraft Wheel and Brake Systems'),
('1640', '16', 'Aircraft Control Cable Components'),
('1650', '16', 'Aircraft Hydraulic, Vacuum, and De-icing System Components'),
('1660', '16', 'Aircraft Air Conditioning, Heating, and Pressurizing Equipment'),
('1670', '16', 'Parachutes, Aerial Pick Up, Delivery, and Cargo Tie Down Equipment'),
('1680', '16', 'Miscellaneous Aircraft Accessories and Components'),
('2840', '28', 'Gas Turbine and Jet Engines, Aircraft, Nonaircraft'),
('2910', '29', 'Engine Fuel System Components, Nonaircraft'),
('2915', '29', 'Engine Fuel System Components, Aircraft'),
('2920', '29', 'Engine Electrical System Components, Nonaircraft'),
('2925', '29', 'Engine Electrical System Components, Aircraft'),
('2945', '29', 'Engine Air and Oil Filters, Strainers, and Cleaners, Aircraft');
GO

PRINT 'Jupiter One USA database setup complete.';
GO
