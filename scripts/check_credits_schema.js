const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ymgvtokwvunaogfnnojj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltZ3Z0b2t3dnVuYW9nZm5ub2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMjAxNzksImV4cCI6MjA4NDc5NjE3OX0.ajjQoynTxsLfKN9F8Q8UrxB99LXYFmSuRi7gb4HvMqI'
);

async function checkSchema() {
    console.log('Checking for tier_legendary_credits column...');
    const { data, error } = await supabase
        .from('profiles')
        .select('tier_legendary_credits')
        .limit(1);

    if (error) {
        console.error('Schema Check Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Schema Check Success! Columns exist.');
    }
}

checkSchema();
