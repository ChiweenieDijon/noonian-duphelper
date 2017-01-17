function (DbuiDataTable, LocalWebService, $state) {
    /*
      {
        "key": "dbui.util.mark_duplicate",
        "label": "Mark as Duplicate...",
        "icon": "fa-file"
      }
    */
    var boClass = this.className;
    var boId = this.targetObj._id;
    var perspective = this.perspective;
    
    if(!window.confirm('Are you sure THIS RECORD is a duplicate that you want to delete?')) {
        return;
    }
    
    DbuiDataTable.showPickerDialog(boClass, perspective, true, function(selectedItem) {
        // console.log(selectedItem);
        
        LocalWebService.call('dupehelper/mark_duplicate', {
           boClass: boClass,
           duplicateId: boId,
           originalId: selectedItem._id
        })
        .then(function(wsResult) {
            alert(wsResult.message);
            $state.go(
                'dbui.view', 
                {
                    className: boClass,
                    id:selectedItem._id,
                    perspective:perspective
                }
            );
        });
    })
}