'use strict';

const Cachie = require('../Cachie');
const cachie = new Cachie({type: Cachie.TYPE.REDIS});

cachie.connect();

// Set.
cachie.string.set('name', 'Tomas', {force: true, returning: true})
.then(response => console.log('Redis set response:', response))
// Get.
.then(() => cachie.string.get('name', {useBunching: true}))
.then(response => console.log('Redis get response:', response));

// Add
cachie.set.add('players', 'Lionel', {force: true})
.then(response => console.log('Redis add response:', response));

// // Get.
// cachie.get('name')
// .then(name => console.log('Name:', name));

// // Add.
// cachie.add('list', 'apple')
// .then(() => cachie.add('list', 'pear'))
// .then(() => cachie.add('list', 'kiwi'))
// .then(() => {
//   cachie.get('list')
//   .then(list => console.log('List:', list));
// });

// const childCache = cachie.childCollection({
//   type: Cachie.TYPE.REDIS,
//   collection: 'child'
// });
// const grandChildCache = childCache.childCollection({
//   type: Cachie.TYPE.REDIS,
//   collection: 'grandchild'
// });


// grandChildCache.connect();

// grandChildCache.set('age', 12);

// grandChildCache.get('age', {includeKey: true})
// .then(age => console.log('Age:', age))
