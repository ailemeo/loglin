
//a very nice solution from
//http://www.jankoatwarpspeed.com/reinventing-a-drop-down-with-css-and-jquery/
//obj : a jQuery object
function createDropDown(obj, def, surrounding){
    var selected = obj.find("option[value="+def+"]");  // get selected <option>
    var options = jQuery("option", obj);  // get all <option> elements
    // create <dl> and <dt> with selected value inside it
    surrounding.append('<dl id="target" class="dropdown"></dl>');
    jQuery("#target").append('<dt><span class="value_text">' + selected.text() + 
     			     '</span><span class="value">' + selected.val() + 
     			     '</span></dt><dd><ul></ul></dd>');
    // iterate through all the <option> elements and create UL
    options.each(function(){
	var jthis=jQuery(this);
        jQuery("#target dd ul").append('<li>' +
				       '<span class="value_text">'+
				       jthis.text() + '</span><span class="value">' + 
				       jthis.val() + '</span></li>');
    });

    jQuery('.dropdown dt').click(function(){
	jQuery('.dropdown dd ul').toggle();
    });
    
    jQuery(document).bind('click',function(e){
	var clicked = jQuery(e.target);
	if(!clicked.parents().hasClass("dropdown")){
	    jQuery('.dropdown dd ul').hide();
	}
    });

    jQuery(".dropdown dd ul li").click(function() {
	var jthis = jQuery(this);
    	var text = jthis.html();
    	jQuery(".dropdown dt").html("Lesson " + text);
    	jQuery(".dropdown dd ul").hide();
    	var source = obj;
    	source.val(jthis.find("span.value").html());
	init_lesson_change(obj);
    });
}


//and my code:
function init_lesson_change(obj){
    var v=parseInt(obj.val());
    if(v>0){
	CURRENT_LESSON=v;
	obj.blur();
	load_lesson(0);		
	$('prev_lesson').verify();
	$('next_lesson').verify();
    }

}

//create the initial select object
function create_lesson_dropdown(){
    var s=jQuery('#jump_to_lesson_select');
    
    for(var i=0;i<=MAX_LESSONS;i++){
	var o = document.createElement('option');
	if(i==0){
	    o.innerHTML="Lesson ...";
	    o.selected="selected";
	} else{
	    o.innerHTML=i;
	}
	console.log(o);
	o.value=i;
	s.append(o);
    }
    s.change(function(){
	init_lesson_change(s);
    });
    s.val(CURRENT_LESSON);
    createDropDown(s, 0, jQuery("#lesson_title"));
    s.hide();
}
