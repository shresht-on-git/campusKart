const mongoose = require('mongoose');

async function runCleanup(isDryRun = true) {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuskart');

  const User = mongoose.model('User', new mongoose.Schema({ email: String, name: String }, { strict: false }));
  const Listing = mongoose.model('Listing', new mongoose.Schema({
    title: String, seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }, { strict: false }));
  const PurchaseRequest = mongoose.model('PurchaseRequest', new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }
  }, { strict: false }));
  const Conversation = mongoose.model('Conversation', new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }
  }, { strict: false }));
  const Message = mongoose.model('Message', new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }
  }, { strict: false }));
  const Review = mongoose.model('Review', new mongoose.Schema({
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    purchaseRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequest' }
  }, { strict: false }));

  const genuineEmails = new Set([
    'sbhanot_be24@thapar.edu',
    'sbajaj@thapar.edu',
    'sbajaj_be24@thapar.edu',
    'vatsal@thapar.edu',
    'naitik@thapar.edu',
    'ani@thapar.edu',
    'ani24@thapar.edu'
  ]);

  const allListings = await Listing.find().populate('seller').lean();

  const testListings = [];
  const genuineListings = [];

  for (const l of allListings) {
    if (l.seller && genuineEmails.has(l.seller.email)) {
      genuineListings.push(l);
    } else {
      testListings.push(l);
    }
  }

  const testListingIds = testListings.map(l => l._id);
  const testConvs = await Conversation.find({ listing: { $in: testListingIds } }).select('_id').lean();
  const testConvIds = testConvs.map(c => c._id);

  const testPRs = await PurchaseRequest.find({ listing: { $in: testListingIds } }).select('_id').lean();
  const testPRIds = testPRs.map(p => p._id);

  const testMessagesCount = await Message.countDocuments({ conversation: { $in: testConvIds } });
  const testReviewsCount = await Review.countDocuments({
    $or: [
      { conversation: { $in: testConvIds } },
      { purchaseRequest: { $in: testPRIds } }
    ]
  });

  console.log(`\n======================================================`);
  console.log(`CLEANUP PLAN (${isDryRun ? 'DRY RUN - PREVIEW ONLY' : 'EXECUTING LIVE CLEANUP'})`);
  console.log(`======================================================`);
  console.log(`Total listings in database: ${allListings.length}`);
  console.log(`Genuine listings to PRESERVE: ${genuineListings.length}`);
  console.log(`Test listings to REMOVE: ${testListings.length}`);
  console.log(`Associated Purchase Requests to clean: ${testPRIds.length}`);
  console.log(`Associated Conversations to clean: ${testConvIds.length}`);
  console.log(`Associated Messages to clean: ${testMessagesCount}`);
  console.log(`Associated Reviews to clean: ${testReviewsCount}`);
  console.log(`User accounts touched: 0 (ALL USERS PRESERVED)`);
  console.log(`======================================================\n`);

  if (!isDryRun) {
    const delListings = await Listing.deleteMany({ _id: { $in: testListingIds } });
    const delPRs = await PurchaseRequest.deleteMany({ listing: { $in: testListingIds } });
    const delMsgs = await Message.deleteMany({ conversation: { $in: testConvIds } });
    const delConvs = await Conversation.deleteMany({ _id: { $in: testConvIds } });
    const delRevs = await Review.deleteMany({
      $or: [
        { conversation: { $in: testConvIds } },
        { purchaseRequest: { $in: testPRIds } }
      ]
    });

    console.log(`✓ Deleted ${delListings.deletedCount} test listings.`);
    console.log(`✓ Deleted ${delPRs.deletedCount} associated test purchase requests.`);
    console.log(`✓ Deleted ${delConvs.deletedCount} associated test conversations.`);
    console.log(`✓ Deleted ${delMsgs.deletedCount} associated test messages.`);
    console.log(`✓ Deleted ${delRevs.deletedCount} associated test reviews.`);
  }

  await mongoose.disconnect();
}

const isExecute = process.argv.includes('--execute');
runCleanup(!isExecute).catch(console.error);
