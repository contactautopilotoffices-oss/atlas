-- ATLAS 014: the Digitide Noida link moves from the main map (a client view
-- at "/") to its own study at /noida/, built like the Chennai study. The slug
-- and access ID stay the same, so visit history and any saved content carry
-- over. Safe to run more than once.
begin;

update atlas_links
   set name       = 'Noida office study (Digitide)',
       kind       = 'study',
       path       = '/noida/',
       updated_at = now()
 where slug = 'digitide-noida';

commit;
