function (db, DupeUtil, queryParams, Q, _) {
    
    if(!queryParams.id) {
        throw 'Missing required parameter(s)';
    }
    
    var dupeList;
    
    return db.DupeList.findOne({_id:queryParams.id}).then(function(dl) {
        if(!dl) {
            throw 'invalid DupeList id '+queryParams.id;
        }
        dupeList = dl;
        console.log(dl);
        
        return db.DupeSpec.findOne({_id:dupeList.spec._id}).exec();
    })
    .then(function(dupeSpec) {
        
        var boClass = dupeList.orig.ref_class;
        var origId = dupeList.orig._id;
        
        var promiseChain = Q(true);
        _.forEach(dupeList.dups, function(dupRef) {
            var dupId = dupRef._id;
            
            promiseChain = promiseChain.then(DupeUtil.markDuplicate.bind(undefined, boClass, origId, dupId, dupeSpec.merge))
            
        });
        
        return promiseChain;
    })
    
    .then(function(count) {
        return {message:'updated '+count+' references'};
    });
}