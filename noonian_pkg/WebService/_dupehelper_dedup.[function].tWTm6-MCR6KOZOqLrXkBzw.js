function (DupeUtil, queryParams) {
    var boClass = queryParams.boClass;
    var origId = queryParams.originalId;
    var dupId = queryParams.duplicateId;
    
    if(!boClass || !origId || !dupId) {
        throw 'Missing required parameter(s)';
    }
    
    return DupeUtil.dupeCleanup(boClass, origId, dupId).then(function(count) {
        return {message:'updated '+count+' references'};
    });
}