-- 020: Disable the bestseller snapshot retention cron job
-- Requested to accumulate data indefinitely

DO $$
BEGIN
    -- Check if the cron job exists before attempting to unschedule
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bw-bestseller-retention') THEN
        PERFORM cron.unschedule('bw-bestseller-retention');
    END IF;
END $$;
