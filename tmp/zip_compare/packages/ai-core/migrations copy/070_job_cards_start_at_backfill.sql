UPDATE job_cards
SET start_at = NULL
WHERE start_at IS NULL;
