-- Update sample calls with realistic resolution statuses and satisfaction scores
-- Update about 60% of calls to 'resolved' with good satisfaction scores
UPDATE calls 
SET 
  resolution_status = 'resolved',
  satisfaction_score = CASE 
    WHEN random() < 0.3 THEN 5  -- 30% excellent
    WHEN random() < 0.6 THEN 4  -- 30% great  
    WHEN random() < 0.8 THEN 3  -- 20% good
    ELSE 4  -- default to great
  END
WHERE resolution_status = 'pending' 
  AND random() < 0.6;

-- Update about 20% of remaining calls to 'resolved' with lower satisfaction scores
UPDATE calls 
SET 
  resolution_status = 'resolved',
  satisfaction_score = CASE 
    WHEN random() < 0.5 THEN 2  -- 50% fair
    ELSE 3  -- 50% good
  END
WHERE resolution_status = 'pending' 
  AND random() < 0.25;

-- Update about 10% of remaining calls to 'escalated' with mixed satisfaction scores
UPDATE calls 
SET 
  resolution_status = 'escalated',
  satisfaction_score = CASE 
    WHEN random() < 0.4 THEN 2  -- 40% fair
    WHEN random() < 0.7 THEN 3  -- 30% good
    ELSE 4  -- 30% great
  END
WHERE resolution_status = 'pending' 
  AND random() < 0.12;

-- Update about 5% of remaining calls to 'unresolved' with lower satisfaction scores
UPDATE calls 
SET 
  resolution_status = 'unresolved',
  satisfaction_score = CASE 
    WHEN random() < 0.6 THEN 1  -- 60% poor
    ELSE 2  -- 40% fair
  END
WHERE resolution_status = 'pending' 
  AND random() < 0.06;