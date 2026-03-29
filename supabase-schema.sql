-- Create the logs table for Node 414 bathroom stall app
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text TEXT NOT NULL,
    app_id TEXT NOT NULL DEFAULT 'vehicle-node-414',
    upvotes INTEGER DEFAULT 0,
    author_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS logs_app_id_idx ON public.logs(app_id);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON public.logs(created_at DESC);
CREATE INDEX IF NOT EXISTS logs_upvotes_idx ON public.logs(upvotes DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
-- Allow anyone to read logs
CREATE POLICY "Anyone can view logs" ON public.logs
    FOR SELECT USING (true);

-- Allow anyone to insert logs (anonymous users)
CREATE POLICY "Anyone can insert logs" ON public.logs
    FOR INSERT WITH CHECK (true);

-- Allow anyone to update upvotes only
CREATE POLICY "Anyone can upvote logs" ON public.logs
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Allow anyone to delete logs (admin uses client-side password gate)
CREATE POLICY "Anyone can delete logs" ON public.logs
    FOR DELETE USING (true);

-- Grant permissions to anonymous users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs TO authenticated;

-- Create a function to increment upvotes safely
CREATE OR REPLACE FUNCTION increment_upvotes(log_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.logs 
    SET upvotes = upvotes + 1 
    WHERE id = log_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_upvotes(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_upvotes(UUID) TO authenticated;
