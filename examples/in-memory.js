'use strict';

const Cachie = require('../Cachie');
const cachie = new Cachie({type: Cachie.TYPE.IN_MEMORY});


// Set.
cachie.set('name', 'Tomas');

// Get.
cachie.get('name')
.then(name => console.log('Name:', name));

// Add.
cachie.add('list', 'apple')
.then(() => cachie.add('list', 'pear'))
.then(() => cachie.add('list', 'kiwi'))
.then(() => {
  cachie.get('list')
  .then(list => console.log('List:', list));
});


const childCache = cachie.childCollection({
  type: Cachie.TYPE.IN_MEMORY,
  collection: 'child'
});
const grandChildCache = childCache.childCollection({
  type: Cachie.TYPE.IN_MEMORY,
  collection: 'grandchild'
});

grandChildCache.set('age', 12);

grandChildCache.get('age', {includeKey: true})
.then(age => console.log('Age:', age))
