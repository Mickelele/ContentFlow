-- Tablica Kanban zadań: własna kolejność kart w kolumnie (niezależna od kolejności w planie dnia).
-- Liczba zmiennoprzecinkowa pozwala wstawić kartę między dwie inne bez przenumerowywania całej kolumny.
alter table public.tasks add column board_position double precision;
create index tasks_board on public.tasks (workspace_id, status, board_position);
