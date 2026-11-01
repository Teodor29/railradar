CREATE TABLE stations (
  signature  text PRIMARY KEY,   -- LocationSignature
  name       text NOT NULL,
  lat        double precision,
  lon        double precision,
  updated_at timestamptz
);

CREATE TABLE train_positions (
  id             bigserial PRIMARY KEY,
  train_number   text NOT NULL,  -- AdvertisedTrainNumber
  departure_date date NOT NULL,  -- unikt tillsammans med tågnummer
  lat            double precision NOT NULL,
  lon            double precision NOT NULL,
  speed          int,            -- km/h
  bearing        int,            -- grader
  measured_at    timestamptz NOT NULL
);

CREATE INDEX train_positions_train_idx ON train_positions (train_number, departure_date, measured_at);
CREATE INDEX train_positions_measured_at_idx ON train_positions (measured_at);
