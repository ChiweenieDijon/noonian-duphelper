function (db, queryParams) {
    var boClass = queryParams.boClass;
    var origId = queryParams.originalId;
    var dupId = queryParams.duplicateId;
    
    if(!boClass || !origId || !dupId) {
        throw 'Missing required parameter(s)';
    }
    
    
    return db.DupeSpec.findOne({'class.class_name':boClass}).then(function(ds) {
        if(!ds) {
            throw new Error('missing DupeSpec for class '+boClass);
        }
        
        var dupList = new db.DupeList({
            spec:ds,
            orig:{_id:origId, ref_class:boClass},
            dups:[{_id:dupId, ref_class:boClass}]
        });
        return dupList.save().then(function() {
            return {
                dupelist_id:dupList._id,
                message:'Please compare, merge,and save, then click DEDUP'
            };
        })
    });
    
}