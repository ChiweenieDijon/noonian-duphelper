function (DbuiObjectPicker, Dbui, NoonWebService, $state) {
    /*
      {
        "ui_action": "dbui.util.mark_duplicate",
        "label": "Mark as Duplicate...",
        "icon": "fa-file"
      }
    */
    var boClass = this.className;
    var boId = this.targetObj._id;
    var perspective = this.perspective;
    
    
    Dbui.getPerspective('diff-compare', boClass, 'picker_list').then(function(perspective) {
        
        perspective.filter = {
            _id:{$ne:boId}
        };
        DbuiObjectPicker.showPickerDialog(boClass, 'diff-compare', true, function(selectedItem) {
            // console.log(selectedItem);
            
            NoonWebService.call('dupehelper/mark_duplicate', {
               boClass: boClass,
               duplicateId: selectedItem._id,
               originalId: boId
            })
            .then(function(wsResult) {
                console.log(wsResult);
                $state.go(
                    'dbui.custompage', 
                    {
                        'key': 'dbui.util.compare_dupes',
                        id:wsResult.dupelist_id
                    }
                );
            });
        });
    });
}