-- Clean up fake/simulated data
DELETE FROM suggestions;
DELETE FROM transcripts;

-- Also clean up any test calls that might have fake data
DELETE FROM calls WHERE customer_number LIKE '+1-555-%';