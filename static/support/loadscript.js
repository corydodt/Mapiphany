// from Rick at http://api.jquery.com/jQuery.getScript/#comment-49855385
function loadScript(_dnpScript)
{
    if (window.loadList.indexOf(_dnpScript) < 0) {
        var successflag = false;

        jQuery.ajax({
            async: false,
            type: "GET",
            url: _dnpScript,
            data: null,
            success: function() { 
                successflag = true; 
                window.loadList.push(_dnpScript);
            },
            cache: true,
            dataType: 'script'
        });
        return successflag;
    } else {
        return true;
    }
} 

window.loadList = [];
