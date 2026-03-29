import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appId = process.env.NEXT_PUBLIC_APP_ID || 'vehicle-node-414';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const seedEntries = [
  {
    text: "If you're reading this, I'm currently in line at Conrad's and I've already accepted that tomorrow is a lost cause.",
    created_at: new Date('2024-01-15T02:45:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 15) + 5
  },
  {
    text: "To the girl crying outside the Landshark: It's okay, he was a business major. You can do better.",
    created_at: new Date('2024-01-15T03:12:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 25) + 10
  },
  {
    text: 'Note to self: The "Blue Drink" is a trap. The third one is always a mistake.',
    created_at: new Date('2024-01-15T03:50:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 20) + 8
  },
  {
    text: "I'm 90% sure I left my dignity at Harper's, but 100% sure I still have my phone. W.",
    created_at: new Date('2024-01-15T04:15:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 18) + 6
  },
  {
    text: "To whoever is in this car right now: I hope your brunch at Peanut Barrel is better than my headache.",
    created_at: new Date('2024-01-15T08:30:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 12) + 3
  },
  {
    text: "System Admin Note: Node 414 is currently monitoring the East Lansing sector. Leave a trace or be forgotten.",
    created_at: new Date('2024-01-15T09:15:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 30) + 15
  },
  {
    text: "The Sunday morning library grind is calling, but the bed is winning. If you're heading to the library, study for me too.",
    created_at: new Date('2024-01-15T10:05:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 16) + 7
  },
  {
    text: "I just realized I spent $40 on DoorDash while sitting in the bar. Someone delete my apps.",
    created_at: new Date('2024-01-15T10:20:00Z').toISOString(),
    upvotes: Math.floor(Math.random() * 22) + 9
  }
];

async function seedDatabase() {
  console.log('🌱 Seeding Node 414 database with MSU entries...');
  
  try {
    // Generate random author IDs for each entry
    const entriesWithAuthors = seedEntries.map(entry => ({
      ...entry,
      app_id: appId,
      author_id: `anon_${Math.random().toString(36).substring(2, 15)}`
    }));

    const { data, error } = await supabase
      .from('logs')
      .insert(entriesWithAuthors);

    if (error) {
      console.error('❌ Error seeding database:', error);
      return;
    }

    console.log('✅ Successfully seeded database with', seedEntries.length, 'entries');
    console.log('🎯 Entries include MSU-specific references:');
    console.log('   - Conrad\'s Grill');
    console.log('   - Landshark Bar & Grill');
    console.log('   - Harper\'s Restaurant & Brewpub');
    console.log('   - Peanut Barrel');
    console.log('   - East Lansing references');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

seedDatabase();
