const { supabase } = require('../scripts/common');

async function testQuery() {
    const term = "헤일";
    const { data, error } = await supabase.from("bw_books").select("id, title, author, publisher, cover_url").ilike("title", `%${term}%`).limit(10);
    console.log("Error:", error);
    console.log("Data length:", data ? data.length : 0);
    console.log("Data:", data);
}
testQuery();
