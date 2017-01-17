function (db, Q, _) {
    var exports = {};
    
    /**
     * "Mark" a BusinessObject as a duplicate of another, meaning: 
     * 1) update any references to the 'dup' object to point to the 'original' one
     * 2) merge in any fields that are null in the 'original' one w/ the values from the 'dup' one.
     * 3) remove the 'dup' one
     * @param boClass
     * @param originalId
     * @param duplicateId
     **/
    exports.markDuplicate = function(boClass, origId, dupId, mergeFn) {
        console.log('Marking %s.%s duplicate of %s', boClass, dupId, origId);
        var origObj;
        var dupObj;
        
        var refCount = 0;
        
        //A default merge function
        // just copy over fields from dup that are null in orig.
        if(!mergeFn) {
            mergeFn = function(orig, dup) {
                var anyChange = false;
                for(var f in dup._bo_meta_data.type_desc_map) {
                    if(
                        (orig[f] == null && dup[f] != null) ||
                        ((origObj[f] instanceof Array && origObj[f].length === 0) && (dupObj[f] instanceof Array && dupObj[f].length > 0))
                    ) {
                        anyChange = true;
                        orig[f] = dup[f];
                    } 
                }
                return anyChange;
            };
        }
        
        return db[boClass].find({_id:{$in:[origId, dupId]}}).then(function(resultArr) {
        
            for(var i=0; i < resultArr.length; i++) {
                if(resultArr[i]._id === origId) {
                    origObj = resultArr[i];
                }
                else {
                    dupObj = resultArr[i];
                }
            }
            
            if(!origObj || !dupObj) {
                throw 'Invalid id(s): '+origId+', '+dupId;
            }
            
            return db.BusinessObjectDef.find({}, {_id:1, class_name:1}).exec();
        })
        .then(function(boNames) {
            
            //Fix references to dupObj to point to origObj
            var promiseList = [];
            
            _.forEach(boNames, function(boName) {
                var tdMap = db[boName._id]._bo_meta_data.type_desc_map;
                _.forEach(tdMap, function(td, fieldName) {
                   if(td.type === 'reference' && td.ref_class === boClass) {
                       var refQuery = {};
                       refQuery[fieldName+'._id'] = dupId;
                       var p = db[boName._id].find(refQuery).then(function(referencingObjects) {
                           var nestedPromiseList = [];
                           var pChain = Q(true);
                           
                           for(var i=0; i < referencingObjects.length; i++) {
                               var refObj = referencingObjects[i];
                               console.log('DUP FIXER: Updating reference from %s.%s[%s] to %s.%s', boName.class_name, refObj._id, fieldName, boClass, origId);
                               refObj[fieldName] = {_id:origId};
                               pChain = pChain.then(refObj.save.bind(refObj, {}));
                            //   nestedPromiseList.push(refObj.save());
                               refCount++;
                           }
                           
                        //   return Q.all(nestedPromiseList);
                           return pChain;
                       });
                       promiseList.push(p);
                   } 
                });
            });
            return Q.all(promiseList).then(function() {
                return db[boClass].findOne({_id:origId}).exec();
            });
            
        })
        .then(function(updatedOrig) {
            origObj = updatedOrig;
            //Merge fields from dupObj, then delete it
            var saveOrig = mergeFn(origObj, dupObj);
            
            var promise1 = saveOrig ? origObj.save() : Q(true);
            console.log('removing duplicate object: %s', dupObj._id);
            return Q.all([promise1, dupObj.remove()]);
        })
        .then(function() {
            return refCount;
        })
        ;
    };
    
    
    return exports;
}