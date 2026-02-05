
-- 1. Create DELETE_ACCOUNT function
create or replace function public.delete_account()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

-- 2. Update PROFILES foreign key
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- 3. Update CLASSES foreign key
alter table public.classes drop constraint if exists classes_user_id_fkey;
alter table public.classes add constraint classes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- 4. Update SCHEDULE ITEMS foreign key
alter table public.schedule_items drop constraint if exists schedule_items_user_id_fkey;
alter table public.schedule_items add constraint schedule_items_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- 5. Update STUDY SESSIONS foreign key
alter table public.study_sessions drop constraint if exists study_sessions_user_id_fkey;
alter table public.study_sessions add constraint study_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
