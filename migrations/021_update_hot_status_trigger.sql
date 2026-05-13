-- 021: Update HOT status trigger logic
-- 1. Use 5x multiplier for comments (instead of 10x)
-- 2. Set 200 point threshold for 'free' (Talk Talk) board (same as 'job')
-- 3. Set 300 point threshold for '[잡담]' category in Talk Talk board

CREATE OR REPLACE FUNCTION public.check_and_update_hot_status()
RETURNS TRIGGER AS $$
DECLARE
    score INTEGER;
    threshold INTEGER;
BEGIN
    -- Do nothing if already HOT
    IF NEW.is_hot THEN
        RETURN NEW;
    END IF;

    -- Calculate score: view_count + (comment_count * 5)
    -- Using 5x multiplier as per latest business logic
    score := COALESCE(NEW.view_count, 0) + (COALESCE(NEW.comment_count, 0) * 5);

    -- Determine threshold based on board type
    -- 'job' and 'free' (Talk Talk) boards require 200 points
    IF NEW.board_type = 'job' OR NEW.board_type = 'free' THEN
        threshold := 200;
        
        -- Special rule: Posts with '[잡담]' in title on Talk Talk board require 300 points
        IF NEW.board_type = 'free' AND NEW.title LIKE '%[잡담]%' THEN
            threshold := 300;
        END IF;
    ELSE
        -- Other boards (support, ai, etc.) require 100 points
        threshold := 100;
    END IF;

    -- Update is_hot status if score reaches threshold
    IF score >= threshold THEN
        NEW.is_hot := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is attached (it was already created in 015, but redefining just in case)
DROP TRIGGER IF EXISTS trigger_update_hot_status ON public.bw_posts;
CREATE TRIGGER trigger_update_hot_status
BEFORE UPDATE OF view_count, comment_count ON public.bw_posts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_update_hot_status();
