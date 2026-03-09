require("dotenv").config();
const Database = require("../src/server/config/database");

async function runSampleSeed() {
  console.log("🚀 Starting Sample Content Seeder...");

  try {
    const supabase = Database.getClient();

    // Generate sample news
    const newsData = [
      {
        title: "City Hall Announces New Digital Services",
        content: "We are excited to announce a new suite of digital services aimed at making transactions with the city government faster and more convenient for all citizens. Starting next month, you can process your permits, pay local taxes, and submit requests entirely online.",
        excerpt: "New digital services for a more convenient transaction experience.",
        category: "Technology",
        tags: ["Digital", "Services", "City Hall"],
        status: "published",
        published_at: new Date().toISOString()
      },
      {
        title: "Road Repair Scheduled for Main Avenue",
        content: "Please be advised that road repairs will commence on Main Avenue starting this weekend. Traffic rerouting will be implemented. We apologize for the temporary inconvenience this may cause as we work to improve our city's infrastructure.",
        excerpt: "Road repair on Main Ave starting this weekend.",
        category: "Infrastructure",
        tags: ["Traffic", "Roadworks"],
        status: "published",
        published_at: new Date().toISOString()
      }
    ];

    console.log("Inserting Sample News...");
    const { error: newsError } = await supabase.from("news").insert(newsData);
    if (newsError) throw newsError;
    console.log("✅ Sample News inserted successfully.");

    // Generate sample events (Updates)
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 7);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 14);

    const eventData = [
      {
        title: "Community Health and Wellness Fair",
        description: "Join us for a day of free medical checkups, wellness seminars, and fitness activities at the City Plaza. Open to all residents.",
        location: "City Plaza",
        event_date: futureDate1.toISOString(),
        category: "Health",
        max_participants: 500,
        status: "upcoming"
      },
      {
        title: "Town Hall Meeting on Environment Policies",
        description: "The Mayor's Office will host a town hall meeting to discuss new environmental sustainability policies and initiatives. Your input is valuable.",
        location: "City Auditorium",
        event_date: futureDate2.toISOString(),
        category: "Environment",
        status: "upcoming"
      }
    ];

    console.log("Inserting Sample Events (Updates)...");
    const { error: eventsError } = await supabase.from("events").insert(eventData);
    if (eventsError) throw eventsError;
    console.log("✅ Sample Events inserted successfully.");

    // Generate sample notices
    const noticeData = [
      {
        title: "Water Service Interruption Notice",
        content: "There will be a scheduled water service interruption in Barangay San Jose and Barangay San Roque on Tuesday due to pipe maintenance. Expected duration is 6 hours (8:00 AM to 2:00 PM).",
        priority: "high",
        type: "Utility",
        valid_from: new Date().toISOString(),
        status: "active"
      },
      {
        title: "Holiday Trash Collection Schedule",
        content: "In observance of the upcoming national holiday, garbage collection schedules will be adjusted. Areas usually serviced on Monday will be serviced on Tuesday instead.",
        priority: "normal",
        type: "Announcement",
        valid_from: new Date().toISOString(),
        status: "active"
      }
    ];

    console.log("Inserting Sample Notices...");
    const { error: noticeError } = await supabase.from("notices").insert(noticeData);
    if (noticeError) throw noticeError;
    console.log("✅ Sample Notices inserted successfully.");

    console.log("🎉 All sample content seeded successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  }
}

runSampleSeed();
