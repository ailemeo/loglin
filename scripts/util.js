function load_html5_slider(boxid,val){
    val = val || slider_step;
    //return function(batch){
    var actual_weight = boxid.value / val;
    var feature_info = boxid.parentNode.parentNode.childNodes[0];
    feature_info.setAttribute('dirty',1);
    if(svg_loaded){
	//get feature index by boxid.parentVal.childNodes[0
	var context =  parseInt(feature_info.getAttribute('context'));
	var feature_name = feature_info.getAttribute('feature_name').split(',')[1];
	var feat_name = INVERSE_FEATURE_LIST[ [CONTEXTS[context],feature_name] ];
	var old_theta = THETA[feat_name];
	//store THETA value
	THETA[feat_name]=isFinite(actual_weight)?actual_weight:(actual_weight>0? 100: -100);
	redraw_all();
    } else{
	feature_info.className+=' feature_name_box';
    }
    //};
}

function get_handle(slider_value_box){
    return slider_value_box.parentNode.childNodes[0].childNodes[1];
}

//REQUIRES: svg_loaded=1
function redraw_all(){
    if(!svg_loaded){return;}
    recompute_partition_function();
    recompute_expected_counts();
    redrawAllExpected();
    compute_ll();
    compute_ll(TRUE_THETA,TRUE_Z_THETA,TRUE_LOG_LIKELIHOOD,TRUE_REGULARIZATION);
    updateLLBar();
    compute_gradient();   
}

//basically from 
//http://www.cricketschirping.com/code/distribution.js and
//http://en.wikipedia.org/wiki/Box-Muller_transform
function normal(mu,sigma){
    return new Object({
	    sigma:sigma,
		mu:mu,
		sample: function(){
		var result;
		if(this.other_val){
		    result=this.other_val;
		    this.other_val=null;
		} else{
		    var r=Math.sqrt(-2*Math.log(Math.random()));
		    var t=2*Math.PI*Math.random();
		    result = r*Math.cos(t)*this.sigma + this.mu;
		    this.other_val = r*Math.sin(t)*this.sigma + this.mu;
		}
		return result;
	    }});
}

function generate_new_observations(ntimes){
    var n=normal(0,0.5);
    for(var l=0;l<FEATURE_LIST.length;l++){
	TRUE_THETA[l] = n.sample();
    }
    recompute_partition_function();
    recompute_partition_function(TRUE_THETA,TRUE_Z_THETA);
    sample_from_true(ntimes);
    //some clean up
    //$$(".feature_slider").forEach(function(t){t.onchange();});
    updateObservedImages();
    svg_loaded=1;
    redraw_all();
}


function sample_from_true(num_times){
    //clear various arrays...
    var oldntokc=NUM_TOKENS_C.slice();
    reset_data_structures();
    //enumerate possible types
    //for every context...
    for(var c=0;c<CONTEXTS.length;c++){
	var a=enumerate_possible_types(c,VISUALS[c]);
	var num_times = num_times || oldntokc[c] || 50;	
	//first lay-out each type along the unit interval
	var s = []; var prev=0; var ncounts = a[1];
	for(var i in a[0]){
	    s[i]=a[0][i]+prev;
	    prev=s[i];
	}
	prev=0;
	//smooth it out, and use negation as a flag
	for(var i=0;i<s.length;i++){
	    if(s[i] == undefined){
		s[i]=-prev;
	    } else{
		prev=s[i];
	    }
	}
	for(var i = 0;i<num_times;i++){
	    var n=Math.random();
	    var j=0;
	    while(n > s[j] && (j++)<s.length){}
	    ncounts[j]++;
	}
	for(var type_id in ncounts){
	    var t=ncounts[type_id];
	    COUNTS[c][type_id]=t;
	    NUM_TOKENS_C[c]+=t;
	}
    }
}


function enumerate_possible_types(context, types_for_context){
    var arr={}; var msum=0; var ncounts={};
    for(var type_id in types_for_context){
	//get the probability of that type
	var t=get_prob(context,type_id,0,TRUE_THETA);
	msum+=t;
	arr[type_id]=t;
	ncounts[type_id]=0;
    }
    for(var tid in arr){
	arr[tid]=arr[tid]/msum;
    }
    return [arr,ncounts];

    //OLD****
    //iterate through visual 
    /*var begin=begin || 0;
    var arr =[]; var l0, l1; var b=[]; var ncounts={};
    for(var i=0;i<REVDIM[0].length;i++){
	l0=TRUE_THETA[INVERSE_FEATURE_LIST[[0,i]]];
	for(var j=0;j<REVDIM[1].length;j++){
	    l1=TRUE_THETA[INVERSE_FEATURE_LIST[[1,j]]];;
	    for(var k=0;k<REVDIM[2].length;k++){
		arr.push(Math.exp(l0+l1+TRUE_THETA[INVERSE_FEATURE_LIST[[2,k]]]));
		var c=[]; c[0]=i; c[1]=j; c[2]=k;
		b.push(c);
		ncounts[c]=0;
	    }
	}
    }
    console.log(arr);
    var msum=sum(arr);
    return [arr.map(function(n){ return n/msum;}), b, ncounts];*/
}

function load_instructions(){
    d3.text(INSTRUCTION_PATH,function(txt){
	    $('instruction_area').innerHTML=txt;
	});
}

function load_textfile(){
    //initially, this is null...
    for(var l=0;l<FEATURE_LIST.length;l++){
	THETA[l]=0; TRUE_THETA[l]=0;
    }
    d3.tsv(TRUE_THETA_PATH,function(rows){
	    rows.forEach(function(record){ 
		    var context_id;
		    if(REVERSE_CONTEXTS[record['context']] == undefined){
			CONTEXTS.push(record['context']);
			context_id = CONTEXTS.length-1;
			NUM_TOKENS_C[context_id]=0;
			NUM_OBSERVATIONS_C[context_id]=0;
			REVERSE_CONTEXTS[record['context']]=context_id;
			DATA_BY_CONTEXT[context_id]={};
			TYPE_OBSERVATIONS_IN_C[context_id]=[];
			POSITION_BY_CONTEXT[context_id]={};
		    } else{
			context_id = REVERSE_CONTEXTS[record['context']];
		    }
		    //add record['feature'] to theta list
		    console.log('adding ['+record['context']+', '+record['feature']+']');
		    FEATURE_LIST.push([record['context'],record['feature']]);
		    var feature_number = FEATURE_LIST.length -1;
		    INVERSE_FEATURE_LIST[[record['context'],record['feature']]]=feature_number;
		    TRUE_THETA[feature_number]=parseFloat(record['value']);
		    THETA[feature_number]=initializeThetaValue();
		    GRADIENT[feature_number]=0;
		    OBS_FEAT_COUNT[feature_number]=0;
		    EXP_FEAT_COUNT[feature_number]=0;
		    REG_FOR_GRAD[feature_number]=0;
		    //check for 'weight' --- how strongly the feature fires
		    if(record.hasOwnProperty('weight')){
			var ts=parseFloat(record['weight']);
			if(! isFinite(ts)){
			    ts=1;
			}
			THETA_STRENGTH[feature_number] = ts;
		    } else{
			THETA_STRENGTH[feature_number] = 1;
		    }
		});
	    d3.tsv(OBSERVATION_PATH,function(rows){
		    record_data(rows,0);
		    $("zero_weights_button").onclick();
		});
});
}

//rows is array of associative arrays
function record_data(rows,already_created){
    if(already_created){
	console.log('adding new data!!!');
    }
    rows.forEach(function(record) {
	    if(already_created){
	    }
	    record_observation(record);
	});
    if(!already_created){
    	addFeaturesToList($("feature_table"),FEATURE_LIST);
    	addSliderEffects();
    } else{
    	$$(".feature_slider").forEach(function(t){t.onchange();});
    }
    recompute_partition_function(THETA,Z_THETA);
    console.log(Z_THETA);
    //draw the data here!
    if(!already_created){
    	drawSVGBoxes($("draw_area"));
    } else{
    	updateObservedImages();
    }
    svg_loaded=1;
    //compute the true partition function
    recompute_partition_function(TRUE_THETA,TRUE_Z_THETA);
    //compute expected counts
    recompute_expected_counts();
    //so that we can draw in the expected images
    redrawAllExpected();
    //and, more importantly, the loglikelihood score bar
    console.log('computing ll');
    compute_ll();
    console.log('... then ll of true');
    compute_ll(TRUE_THETA,TRUE_Z_THETA,TRUE_LOG_LIKELIHOOD, TRUE_REGULARIZATION);
    console.log('... then gradient');
    compute_gradient();
    /*console.log('gradient is ');
    console.log(GRADIENT);	 
    console.log(OBS_FEAT_COUNT);
    console.log(EXP_FEAT_COUNT);
    console.log(REG_FOR_GRAD);*/
    
    if(!already_created){
	console.log('add ll bars...');
     	addLLBar();
	console.log('..done');
    } else{
    	updateLLBar();
    }
}

function record_observation(record){
    var features = record['features'];
    var split_features =features.split(',');
    var type_index;
    if(TYPE_MAP[features]==undefined){
	TYPE_INDEX.push(split_features);
	type_index=TYPE_INDEX.length -1;
	TYPE_MAP[split_features]=type_index;
    } else{
	type_index = TYPE_MAP[features];
    }
    var context_id;
    if(REVERSE_CONTEXTS[record['context']] == undefined){
	CONTEXTS.push(record['context']);
	context_id = CONTEXTS.length-1;
	NUM_TOKENS_C[context_id]=0;
	NUM_OBSERVATIONS_C[context_id]=0;
	REVERSE_CONTEXTS[record['context']]=context_id;
	DATA_BY_CONTEXT[context_id]={};
	POSITION_BY_CONTEXT[context_id]={};
    } else{
	context_id = REVERSE_CONTEXTS[record['context']];
    }
    DATA_BY_CONTEXT[context_id][type_index]=split_features;

    //updated USED_FEATURES list
    for(var sf=0;sf<split_features.length;sf++){
	var ifl=INVERSE_FEATURE_LOOKUP(context_id,split_features[sf]);
	if(ifl>=0){
	    USED_FEATURES[ifl]=1;
	}
    }

    //update counts, both observed and expected
    var temp_counts = COUNTS[context_id];
    if(!temp_counts){ temp_counts={};}
    var count=parseFloat(record['count']);
    temp_counts[type_index]=count;
    COUNTS[context_id]=temp_counts;
    var temp_ecounts = EXPECTED_COUNTS[context_id];
    if(!temp_ecounts){ temp_ecounts={};}
    temp_ecounts[type_index]=0;
    EXPECTED_COUNTS[context_id]=temp_ecounts;

    NUM_TOKENS+=count;
    NUM_TOKENS_C[context_id] += count;
    NUM_OBSERVATIONS++;
    NUM_OBSERVATIONS_C[context_id]++;
    TYPE_OBSERVATIONS_IN_C[context_id].push(type_index);

    //now deal with positions
    var temp_pos=(d3.csv.parseRows(record['position'])[0]).map(function(d){return parseInt(d);});
    POSITION_BY_CONTEXT[context_id][temp_pos] = type_index;
    //REVERSE_POSITIONS[temp_pos] = features.split(',');
    //    POSITIONS.push(temp_pos);
    MAX_ROWS = temp_pos[0]>=MAX_ROWS?temp_pos[0]+1:MAX_ROWS;
    MAX_COLS = temp_pos[1]>=MAX_COLS?temp_pos[1]+1:MAX_COLS;
    var temp_vis = VISUALS[context_id];
    if(!temp_vis){ temp_vis={};}
    temp_vis[type_index]=
	(function(d){
	    var r={};
	    for(var i=0;i<d.length;i++){
		var sa=d[i].split('=');
		r[sa[0]]=sa[1];
	    }
	    return r;
	})(d3.csv.parseRows(record['visualization'])[0]);
    VISUALS[context_id]=temp_vis;
}


function initializeThetaValue(){
    if(initialize==-1){
	return normal(0,1).sample();
    } else if(initialize==-2){
	return ((Math.random()>.5)?1:-1)*10*Math.random();
    }else {
	return initialize;
    }
}


function addSliderEffects(){
    var group=jQuery(".feature_slider");
    group.rangeinput();
    var lb = inverse_sigmoid(0.000001);
    var ub = inverse_sigmoid(slider_width-handle_width-0.000001);
    if(group=$$(".feature_slider")){
	for(var i=0;i<group.length;i++){
	    var handle_tmpfn=function(){
		//handle
		this.parentNode.parentNode.childNodes[1].value= inverse_sigmoid(parseFloat(this.style['left']+handle_width/2)); //Math.max(lb,Math.min(ub,inverse_sigmoid(parseFloat(this.style['left']))));
		load_html5_slider(this.parentNode.parentNode.childNodes[1],SLIDER_DIV);
	    };
	    var tmpfn=function(){
		this.value = inverse_sigmoid(parseFloat(this.parentNode.childNodes[0].childNodes[1].style['left'] + handle_width/2)); //Math.max(lb,Math.min(ub,inverse_sigmoid(parseFloat(this.parentNode.childNodes[0].childNodes[1].style['left']))));
		load_html5_slider(this,SLIDER_DIV);
	    };
	    group[i].onchange = tmpfn;
	    group[i].parentNode.childNodes[0].childNodes[1].ondrag=handle_tmpfn;
	    group[i].onchange();
	    var theta_index = group[i].parentNode.parentNode.childNodes[0].getAttribute('theta_index');
	    if(USED_FEATURES[theta_index]==undefined){//is unused/unavailable
		group[i].parentNode.parentNode.style.display='none';
		group[i].parentNode.parentNode.className += ' unused_feature';
		group[i].disabled='disabled';
	    }
	}
    }
}


function recompute_partition_function(theta,ztheta){
    var ttheta=theta;
    theta=theta || THETA;
    ztheta=ztheta || Z_THETA;
    //iterate through contexts
    for(var c=0;c<CONTEXTS.length;c++){
	//iterate through type observations of context c
	var tz=0;
	var obs_in_c=TYPE_OBSERVATIONS_IN_C[c];
	for(var i=0;i<obs_in_c.length;i++){
	    tz+=get_prob(c,obs_in_c[i],0,theta);
	}
	ztheta[c]=tz;
    }
    return ztheta;
}

function formatExpected(ecp){
    //return (ecp > 1.0)?Math.round(ecp):ecp.toFixed(2);
    return ecp.toFixed(2);
}

function determine_color(obs,exp){
    if(Math.abs(obs-exp)<0.01){
	return COUNTS_EQUAL
    } else{
	if(obs>exp) return COUNTS_TOO_LOW;
	else return COUNTS_TOO_HIGH;
    }
}

function recompute_expected_counts(){
    for(var c=0;c<CONTEXTS.length;c++){
	var obs_in_c=TYPE_OBSERVATIONS_IN_C[c];
	//go through type IDs
	for(var i=0;i<obs_in_c.length;i++){
	    var id_num = obs_in_c[i];
	    var p=$('exp_count_text_'+id_num); var ecp=get_expected_count(c,id_num);
	    EXPECTED_COUNTS[c][id_num]=ecp;
	    var obs_count = COUNTS[c][id_num];
	    var color=determine_color(obs_count,ecp);
	    p.innerHTML =  color==COUNTS_EQUAL?obs_count:formatExpected(ecp);
	    p.style.color=color;
	    p.setAttribute('dirty',0);
	    p.setAttribute('value',ecp);
	}
    }
}


function reset_sliders_manually(arr){
    var group = $$('.feature_slider');
    for(var i=0;i<group.length;i++){
	group[i].value = arr[i][1];
	var val=sigmoid_transform(arr[i][1]);
	get_handle(group[i]).style.left = val+'px';
	THETA[arr[i][0]]=parseFloat(arr[i][1]);
    }
}

function step_gradient(solve_step){
    var solve_step=solve_step || SOLVE_STEP;
    var all_zero=0;
    var group = $$('.feature_slider');
    var arr = group.map(function(d,i){
	    var tindex = group[i].parentNode.parentNode.childNodes[0].getAttribute('theta_index');
	    return [tindex,THETA[tindex] + solve_step*GRADIENT[tindex]];
	});
    reset_sliders_manually(arr);
    redraw_all();
}

function converged(prev_ll,step_size){
    var good=true;
    for(var i=0;i<prev_ll.length;i++){
	good = good && 
	    (Math.abs(LOG_LIKELIHOOD[i] - prev_ll[i])/step_size<STOPPING_EPS);
    }
    return good;
}
function scale_gamma_for_solve(gamma0,step_num){
    return gamma0/Math.sqrt(step_num/10);
}

//gamma is original gamma
function solve_puzzle(gamma, step_num, orig_step_size){
    //grab prev ll
    var prev_ll = LOG_LIKELIHOOD.slice();
    var gamma = scale_gamma_for_solve(gamma,step_num);
    //SOLVE_STEP=gamma;
    $('gradient_step').value = gamma.toPrecision(5);
    step_gradient(gamma);
    if(step_num==MAX_SOLVE_ITERATIONS || converged(prev_ll,gamma)){
	$('solve_button').disabled="";
	clearInterval(SOLVE_TIMEOUT_ID);
	$('next_lesson').disabled="";
	$('prev_lesson').disabled="";
	$('change_num_tokens').disabled="";
	$('gradient_step').value = orig_step_size.toPrecision(5);
	$('gradient_step').onchange();
    }
}

function compute_gradient(){
    var print=0;
    //zero out gradient by setting to regularization, if used
    var gl= GRADIENT.length;
    GRADIENT=[];
    OBS_FEAT_COUNT=[]; EXP_FEAT_COUNT=[]; REG_FOR_GRAD=[];
    for(var l=0;l < gl; l++) {
	if(USE_REGULARIZATION){
	    var local_theta = THETA[l];
	    var lte=(REGULARIZATION_EXPONENT==1)?(local_theta>=0?1:-1):local_theta;
	    lte *= REGULARIZATION_EXPONENT*REGULARIZATION_SIGMA2;
	    REG_FOR_GRAD[l]=lte;
	    GRADIENT[l] = lte;
	} else{ GRADIENT[l]=0; REG_FOR_GRAD[l]=0;}	
	OBS_FEAT_COUNT[l]=EXP_FEAT_COUNT[l]=0;
    }
    //iterate through contexts
    for(var c=0;c<CONTEXTS.length;c++){
	//iterate through types in c
	var obs_in_c=TYPE_OBSERVATIONS_IN_C[c];
	for(var j=0;j<obs_in_c.length;j++){
	    //type id is obs_in_c[j]
	    var id_num=obs_in_c[j];
	    //data *is* human readable, e.g., ['circle','solid']
	    var data = TYPE_INDEX[id_num];
	    var stop_length = data.length;
	    var tmp=0; var key; var local_theta;
	    for(var i=0;i<stop_length;i++){
		//get the unique identifying key for this feature in the context
		var feat_num = INVERSE_FEATURE_LIST[ [CONTEXTS[c], data[i]]];
		local_theta = THETA[feat_num];
		//observed feature counts
		tmp = (COUNTS[c][id_num]-0)*THETA_STRENGTH[feat_num];
		OBS_FEAT_COUNT[feat_num] += tmp;
		//expected feature counts
		var tmp_e=NUM_TOKENS_C[c]*get_prob(c,id_num)/Z_THETA[c]*THETA_STRENGTH[feat_num];
		EXP_FEAT_COUNT[feat_num]+=tmp_e;
		tmp -= tmp_e;
		//regularization has been taken care of...
		GRADIENT[feat_num]= ((GRADIENT[feat_num]==undefined)?0:(GRADIENT[feat_num])) + tmp;
	    }
	}
    }
    draw_gradient();
}

function setComponentDisplay(){
    DISPLAY_GRADIENT_COMPONENTS=parseInt(this.value);
}

function fold_colors_percents(pcs){
    var ret=[];
    for(var i=0;i<pcs.length;i++){
	ret.push(pcs[i][1]+" "+pcs[i][0]+'%');
    }
    return ret.join(', ');
}

function generate_gradient_style(npcs){
    var ret='';
    var names = {'-ms-linear-gradient':'left',
		 '-moz-linear-gradient':'left',
		 '-o-linear-gradient':'left',
		 '-webkit-linear-gradient':'left',
		 'linear-gradient':'to right'};
    for(var name in names){
	ret+='background-image: '+name+'('+names[name]+ ', #FFFFFF 0%, '+ fold_colors_percents(npcs) +', #FFFFFF 100%); ';
    }
    ret += ' height:9px; position:relative; cursor:pointer; border:1px solid #333; width:155px; float:left; clear:right; margin-top:10px; -moz-border-radius:5px; -webkit-border-radius:5px; -moz-box-shadow:inset 0 0 8px #000;';
    return ret;
}

function draw_true_theta_on_slider(tt){
    var t=[[tt-1.0001,'#FFFFFF'],[tt-1, col_for_true_theta],
	   [tt+1, col_for_true_theta],[tt+1.0001,'#FFFFFF']];
    return generate_gradient_style(t);
}

function clear_gradient_color(){
    var sh=50.5;
    var t=[[sh-1.0001,'#FFFFFF'],[sh-1, '#000000'],
	   [sh+1, '#000000'],[sh+1.0001,'#FFFFFF']];
    return generate_gradient_style(t);
}


function draw_gradient(){
    if(!SHOW_GRADIENTS){
	var slds = $$(".slider");
	if(slds){// && (gradients_drawn || has_cheated)){
	    for(var i=0;i<slds.length;i++){	
		var g = slds[i].parentNode.parentNode.childNodes[0];
		var theta_id = parseInt(g.getAttribute('theta_index'));
		var sattribute=has_cheated?draw_true_theta_on_slider(bound_dom_range(TRUE_THETA[theta_id])):clear_gradient_color();
		slds[i].setAttribute('style',sattribute);
	    }
	}
	gradients_drawn = 0;
	return;
    }
    gradients_drawn = 1;
    //iterate through sliders
    var fn; var colors;
    switch(DISPLAY_GRADIENT_COMPONENTS){
    case 1:
	fn = function(theta,grad,true_theta){
	    var ntheta = theta + grad;
	    var st = bound_dom_range(theta); var snt = bound_dom_range(ntheta); var sh = bound_dom_range(inverse_sigmoid(slider_width/2));
	    var tt = bound_dom_range(true_theta); 
	    var st1=st; var snt1=snt; var grad_color;
	    if(grad>0){
		st1+=0.00000001; snt1+=0.00000001;
		grad_color='#EE4455';
	    } else{
		st1-=0.00000001; snt1-=0.00000001;
		grad_color='#4455EE';
	    }
	    var t = [[sh-1.00000001,''],
		     [sh-1,'#000000'],
		     [sh+1,'#000000'],
		     [sh+1.00000001,''],
		     [st,'#FFFFFF'],
		     [st1,grad_color],
		     [snt,grad_color],
		     [snt1,'#FFFFFF']];
	    if(has_cheated){
		t.push([tt-1.00000001,'']);
		t.push([tt-1, col_for_true_theta]);
		t.push([tt+1, col_for_true_theta]);
		t.push([tt+1.00000001,'']);
	    }
	    t=t.sortBy(function(d){return d[0];});
	    var first=0; var def_color='#FFFFFF'; var grad_seen=0;
	    var prev_col='#FFFFFF'; var prev_col1='#FFFFFF';
	    for(var i=0;i<t.length;i++){
		if(t[i][1]==''){
		    t[i][1]=prev_col;
		} else{
		    if(t[i][1]==grad_color){
			grad_seen = grad_seen + (grad_seen>0 ? -1:1);
		    }
		    if(prev_col!=t[i][1]){
			prev_col1=prev_col;
			prev_col=t[i][1];
		    } else{
			prev_col=prev_col1;
		    }
		}
	    }
	    t[t.length-1][1]='#FFFFFF';
	    return t;
	};
	break;
    case 2:
	break;
    case 3:
	break;
    default:
	break;
    }
    var group=$$(".slider");
    //scale gradient
    var abs_max_val = SOLVE_STEP;
    var scaled_grad = GRADIENT.map(function(g){ return g/Math.pow(10,Math.floor(abs_max_val)+1); });
    for(var i=0;i<group.length;i++){
	//to get percents 
	var g = group[i].parentNode.parentNode.childNodes[0];
	var handle = group[i].childNodes[1];
	var hand_left =parseFloat(handle.style.left);
	//get the THETA id
	var theta_id = parseInt(g.getAttribute('theta_index'));
	var npcs = fn(THETA[theta_id],scaled_grad[theta_id],TRUE_THETA[theta_id]);
	group[i].setAttribute('style',generate_gradient_style(npcs));
    }
}

function bound_dom_range(x){
    return Math.max(.00001,Math.min(slider_width-handle_width-.0001,sigmoid_transform(x)+handle_width/2))*100/slider_width;
}

function compute_ll(theta, ztable, ll, reg){
    var theta = theta || THETA;
    var ztable = ztable || Z_THETA;
    var ll = ll || LOG_LIKELIHOOD;
    var reg = reg || REGULARIZATION;
    var sum=0; var altsum=0;
    for(var c = 0; c<CONTEXTS.length;c++){
	//iterate through type observations
	var obs_in_c=TYPE_OBSERVATIONS_IN_C[c];
	for(var i=0;i<obs_in_c.length;i++){
	    var id_num=obs_in_c[i];
	    sum += COUNTS[c][id_num] * get_prob(c,id_num,1,theta);
	}
	sum -= NUM_TOKENS_C[c]*Math.log(ztable[c]);
    }
    ll[0] = sum;
    
    if(USE_REGULARIZATION){
	var fn;
	switch(REGULARIZATION_EXPONENT){
	case 1:
	    fn=function(d){ return Math.abs(d);};
	    break;
	case 2:
	default:
	    fn=function(d){ return d*d;};
	    break;
	}
	sum=0;
	for(var i=0;i<theta.length;i++){
		sum += fn(theta[i]);
	}
	sum = sum*REGULARIZATION_SIGMA2;
	reg[0]=sum;
	ll = ll.map(function(d){
		return d - sum;
	    });
    } 
    //console.log("LOG LIKELIHOOD: "+ ll);
}

function createSlider(val,isUnused){
    var d=document.createElement('div');
    var input=document.createElement('input');
    input.type="range"; 
    input.className += ' feature_slider';
    input.setAttribute('min',slider_min); 
    input.setAttribute('max',slider_max);
    input.setAttribute('step',slider_step);
    input.setAttribute('value',val);
    d.appendChild(input);
    d.className += ' html5slider';
    return d;
}

function addFeaturesToList(selectObj, array){
    var nf=0;
    var num_rows = Math.ceil(Math.sqrt(FEATURE_LIST.length)); 
    var num_cols = Math.ceil(FEATURE_LIST.length / num_rows); 
    var feature_index=0;
    var num_columns=array.length;
    for(var i=0;i<num_rows;i++){
	var tr=document.createElement('tr');
	tr.id='row'+i;
	for(var j=0;j<num_cols && feature_index<FEATURE_LIST.length;j++){
	    var td=document.createElement('td');
	    td.className+=' feature_cell';
	    var d=document.createElement('div');
	    var p=document.createElement('p');
	    var split_fl = FEATURE_LIST[feature_index];
	    var cont_id = REVERSE_CONTEXTS[split_fl[0]];
	    console.log('adding feature '+split_fl[1]+', given '+split_fl[0]);
	    if(split_fl[0]==''){
		p.innerHTML=split_fl[1];
	    } else{
		p.innerHTML=split_fl[1]+', given '+split_fl[0];
	    }
	    p.setAttribute('feature_dimension',i);
	    p.setAttribute('context',cont_id);
	    p.setAttribute('feature_name',FEATURE_LIST[feature_index]);
	    //theta_index is UNIQUE across all features!
	    p.setAttribute('theta_index',feature_index);
	    GRADIENT[feature_index]=0;
	    d.appendChild(p);
	    d.appendChild(createSlider(THETA[feature_index]));
	    td.appendChild(d);
	    tr.appendChild(td);
	    feature_index++;
	}
	selectObj.appendChild(tr);
	if(feature_index>=FEATURE_LIST.length){
	    break;
	}
    }
}

function ll_resizer(min,max){
    var m = (.95-.25)*DIV_LL_WIDTH / (max-min);
    return function(l){
	return m * (l - max) + (.95*DIV_LL_WIDTH);
    };
};

function addLLBar(){
    var svg = d3.select("#ll_area").append("svg").attr('height',20*LOG_LIKELIHOOD.length - 1).attr('width',DIV_LL_WIDTH+RESERVE_LL_WIDTH);
    svg.attr('id','ll_bars');
    var ll = LOG_LIKELIHOOD.map(function(d,i){return d+REGULARIZATION[i];});
    var tll=TRUE_LOG_LIKELIHOOD.map(function(d,i){return d+TRUE_REGULARIZATION[i];});
    //the user distribution LL
    max = function(x,y){return Math.max(x,y);};
    var max_u_ll = ll.reduce(max,-10000000);
    var max_t_ll = tll.reduce(max, -10000000);
    min = function(x,y){return Math.min(x,y);};    
    var min_u_ll = ll.reduce(min, 0);  
    var min_t_ll = tll.reduce(min, 0);
    var overall_max = Math.max(max_u_ll,max_t_ll);
    var overall_min = Math.min(min_u_ll,min_t_ll);
    worst_ll = Math.min(worst_ll,overall_min);
    var resizer = ll_resizer(worst_ll,overall_max);
    if(max_t_ll >= max_u_ll){
    } else{
    }
    //    console.log(TRUE_LOG_LIKELIHOOD.map(resizer));
    //console.log(LOG_LIKELIHOOD.map(resizer));
    var llrects=svg.selectAll(".ll_bar").data(ll).enter().append("rect");
    llrects.attr('x',0)
	.attr('width',function(d,i){
		return resizer(d);
	    })
	.attr('height',15)
	.attr('y',function(d,i){
		return 2*i*20;
	    })
	.attr('stroke','gray')
	.attr('fill',function(d){
		return "gray";
	    })
	.attr('class','ll_bar');
    var tllrects=svg.selectAll(".true_ll_bar").data(tll).enter().append("rect");
    tllrects.attr('x',0)
	.attr('width',function(d,i){
		return resizer(d);
	    })
	.attr('height',15)
	.attr('y',function(d,i){
		return (2*i + 1)*20;
	    })
	.attr('stroke',TRUE_MODEL_COLOR)
	.attr('fill',function(d){
		return TRUE_MODEL_COLOR;
	    })
	.attr('class','true_ll_bar');
    //now see about regularization...
    var regrects=svg.selectAll(".reg_bar");
    var regdata;
    if(USE_REGULARIZATION){
	regdata=REGULARIZATION;
    } else{
	regdata=REGULARIZATION.map(function(d){return d-d;});
    }
    addLLRegBars(svg,LOG_LIKELIHOOD,ll,'reg_bar',regdata,function(d,i){return (2*i)*20;},resizer);
    if(USE_REGULARIZATION){
	regdata=TRUE_REGULARIZATION;
    } else{
	regdata=TRUE_REGULARIZATION.map(function(d){return d-d;});
    }
    addLLRegBars(svg,TRUE_LOG_LIKELIHOOD,tll,'true_reg_bar',regdata,function(d,i){return (2*i+1)*20;},resizer);

    //add the text LAST!!!
     var lltext=svg.selectAll(".ll_text").data(LOG_LIKELIHOOD).enter().append("text");
     lltext.text(function(d){
	     return d.toFixed(3);
	 })
	 .attr('x',function(d){
	     return resizer(d)+10;
	 })
	.attr('y',function(d,i){
		return (2*i+1)*20 - 7;
	    })
	.attr('stroke','gray')
	.attr('fill',function(d){
		return "gray";
	    });
     lltext.attr('class','ll_text');
    var tlltext=svg.selectAll("#true_ll_text").data(TRUE_LOG_LIKELIHOOD).enter().append("text");
    tlltext.text(function(d){
	    return d.toFixed(3);
	})
	.attr('x',function(d){
		return resizer(d)+10;
	    })
	.attr('y',function(d,i){
		return (2*i+2)*20 - 7;
	    })
	.attr('stroke',TRUE_MODEL_COLOR)
	.attr('fill',function(d){
		return TRUE_MODEL_COLOR;
	    })
	.attr('class','true_ll_text');

}

function addLLRegBars(svg,ll,unregged,cname,regdata,yfn,resizer){
    var regrects=svg.selectAll('.'+cname+'_overlay').data(regdata).enter().append("rect");
    regrects.attr('x',function(d,i){
	    return resizer(ll[i]);
	})
	.attr('width',function(d,i){
		return resizer(unregged[i]) - resizer(ll[i]);
	    })
	.attr('height',15)
	.attr('y',yfn)
	.attr('stroke','white')
	.attr('fill','white')
	.attr('class',cname+'_overlay');
    regrects=svg.selectAll('.'+cname).data(regdata).enter().append("rect");
    regrects.attr('x',function(d,i){
	    return resizer(ll[i]);
	})
	.attr('width',function(d,i){
		return resizer(unregged[i]) - resizer(ll[i]);
	    })
	.attr('height',15)
	.attr('y',yfn)
	.attr('stroke','red')
	.attr('stroke-width','2')
	.attr('fill','white')
	.attr('fill-opacity',0.1) //make transparent
	.attr('class',cname);
}
//ll : regularized LL
//unregged : LL + reg
function updateLLRegBars(svg,ll,unregged,cname,regdata,resizer){
    var regrects=svg.selectAll('.'+cname+'_overlay').data(regdata);
    regrects.attr('x',function(d,i){
	    return resizer(ll[i]);
	})
	.attr('width',function(d,i){
		return resizer(unregged[i]) - resizer(ll[i]);
	    });
    regrects=svg.selectAll('.'+cname).data(regdata);
    regrects.attr('x',function(d,i){
	    return resizer(ll[i]);
	})
	.attr('width',function(d,i){
		return resizer(unregged[i]) - resizer(ll[i]);
	    });
}

function updateLLBar(){
    var svg = d3.select("#ll_bars");
    //we need to "unregularize" the data in order to draw the bars (and show
    //how much regularization affects LL)
    var ll = LOG_LIKELIHOOD.map(function(d,i){return d+REGULARIZATION[i];});
    var tll=TRUE_LOG_LIKELIHOOD.map(function(d,i){return d+TRUE_REGULARIZATION[i];});
    max = function(x,y){return Math.max(x,y);};
    var max_u_ll = ll.reduce(max,-10000000);
    var max_t_ll = tll.reduce(max, -10000000);
    min = function(x,y){return Math.min(x,y);};    
    var min_u_ll = ll.reduce(min, 0);  
    var min_t_ll = tll.reduce(min, 0);
    var overall_max = Math.max(max_u_ll,max_t_ll); 
    var overall_min = Math.min(min_u_ll,min_t_ll);
    worst_ll = Math.min(worst_ll,overall_min);
    var resizer = ll_resizer(worst_ll,overall_max);

    var llrects=svg.selectAll(".ll_bar").data(ll);
    llrects.attr('x',0)
	.attr('width',function(d,i){
		return resizer(d);
	    })
	.attr('y',function(d,i){
		return 2*i*20;
	    });
    var lltext=svg.selectAll(".ll_text").data(LOG_LIKELIHOOD);
    lltext.text(function(d){
	    return d.toFixed(3);
	})
	.attr('x',function(d,i){
		return resizer(d)+10;
	    })
	.attr('y',function(d,i){
		return (2*i+1)*20 - 7;
	    });
    var tllrects=svg.selectAll(".true_ll_bar").data(tll);
    tllrects.attr('x',0)
	.attr('width',function(d,i){
		return resizer(d);
	    })
	.attr('y',function(d,i){
		return (2*i + 1)*20;
	    });
    var tlltext=svg.selectAll(".true_ll_text").data(TRUE_LOG_LIKELIHOOD);
    tlltext.text(function(d){
	    return d.toFixed(3);
	})
	.attr('x',function(d,i){
		return resizer(d)+10;
	    })
	.attr('y',function(d,i){
		return (2*i+2)*20 - 7;
	    });

    //now see about regularization...
    var regrects=svg.selectAll(".reg_bar");
    var regdata;
    if(USE_REGULARIZATION){
	regdata=REGULARIZATION;
    } else{
	regdata=REGULARIZATION.map(function(d){return 0;});
    }
    updateLLRegBars(svg,LOG_LIKELIHOOD,ll,'reg_bar',regdata,resizer);
    if(USE_REGULARIZATION){
	regdata=TRUE_REGULARIZATION;
    } else{
	regdata=TRUE_REGULARIZATION.map(function(d){return 0;});
    }
    updateLLRegBars(svg,TRUE_LOG_LIKELIHOOD,tll,'true_reg_bar',regdata,resizer);
}


function createStar(){
    var s = document.createElement('polygon');
    s.setAttribute("points","100,10 40,180 190,60 10,60 160,180");
    return s;
}


function createCircleRadius(count,max_count,scale){
    //when maximal, I want radius to be half of height
    //I need to absorb the 1/Math.sqrt(Math.PI) into the scale...
    //so don't even bother including it
    return Math.sqrt(count/max_count)*(scale-1);
}

function createTrianglePoints(cx,width,cy,height,count,max_count,scale){
    var points=[];
    //var side=Math.sqrt(4*count/(Math.sqrt(3)*max_count));
    //check this...
    var r = Math.sqrt(count/max_count * 8/(3*Math.sqrt(3)))*2*scale/3;
    //var r=side/Math.sqrt(3) * scale;
    points.push([cx,height/2 - r]);
    points.push([cx - r * Math.sqrt(3)/2, cy + r/2]);
    points.push([cx + r * Math.sqrt(3)/2, cy + r/2]);
    return points;
}

function updateD3Shape(container, id_num, id_name, width,height,shape,color,fill,count,max_count){
    var s;
    var scale=Math.min(width/2,height/2);
    if(shape=="circle"){
	s=container.selectAll('#'+id_name).data([count]);
	s.attr('cx',width/2)
	    .attr('cy',height/2)
	    .attr('r', createCircleRadius(count,max_count,scale))
    } else if(shape=="square"){
	s=container.selectAll('#'+id_name).data([count]);
	var rwid, rhei;
	rwid = Math.sqrt(count/max_count)*2*scale;
	rhei=rwid;
	s.attr('x',(width-rwid)/2)
	    .attr("y",(height-rhei)/2)
	    .attr("width",rwid)
	    .attr("height",rhei);
    } else if(shape=="tri" || shape=="triangle"){
	s=container.selectAll('#'+id_name).data([count]);
	s.attr('points',createTrianglePoints(width/2,width,height/2,height,count,max_count,scale).map(function(d){return d.join(",");}).join(" "));
    }  else if(shape=="pentagon"){
	s=container.selectAll('#'+id_name).data([count]);
	var rwid, rhei;
	rwid = Math.sqrt(count/max_count)*2*scale;
	rhei=rwid;
	s.attr('x',(width-rwid)/2)
	    .attr("y",(height-rhei)/2)
	    .attr("width",rwid)
	    .attr("height",rhei);
    }
    s.attr('stroke',color);
    if(fill=='solid'){
	s.attr('fill',color);
    } else if(fill=='hollow'){
	s.attr('fill','white');
    } else if(fill=='striped'){
	$('stripe_path_'+id_name).style['stroke']=color;
	s.attr('style','fill: url(#stripe_'+ id_name +'); stroke: '+color+'; opacity:'+EXPECTED_TRANSPARENCY+';');
    }
    return s;
}

function createD3Shape(container, id_num, id_name, width,height,shape,color,fill,count,max_count,opacity){
    if(fill=='striped'){
	var cloned=$('stripe_def').cloneNode(true);
	cloned.setAttribute('id','stripe_def_'+id_name);
	cloned.childNodes[1].setAttribute('id','stripe_'+id_name);
	cloned.childNodes[1].childNodes[1].setAttribute('id','stripe_path_'+id_name);
	cloned.childNodes[1].childNodes[1].style['stroke']=color;
	container[0][0].appendChild(cloned);
    }
    var s;
    var scale=Math.min(width/2,height/2);
    if(shape=="circle"){
	s=container.selectAll('#'+id_name).data([count]).enter().append("circle");
	s.attr('cx',width/2)
	    .attr('cy',height/2)
	    .attr('r', createCircleRadius(count,max_count,scale));
    } else if(shape=="square"){
	s=container.selectAll('#'+id_name).data([count]).enter().append("rect");
	var rwid, rhei;
	rwid = Math.sqrt(count/max_count)*2*scale;
	rhei=rwid;
	s.attr('x',(width-rwid)/2)
	    .attr("y",(height-rhei)/2)
	    .attr("width",rwid)
	    .attr("height",rhei);
    } else if(shape=="tri" || shape=="triangle"){
	s=container.selectAll('#'+id_name).data([count]).enter().append("polygon");
	s.attr('points',createTrianglePoints(width/2,width,height/2,height,count,max_count,scale).map(function(d){return d.join(",");}).join(" "));
    } else if(shape=="pentagon"){
	s=container.selectAll('#'+id_name).data([count]).enter().append("rect");
	var rwid, rhei;
	rwid = Math.sqrt(count/max_count)*2*scale;
	rhei=rwid;
	s.attr('x',(width-rwid)/2)
	    .attr("y",(height-rhei)/2)
	    .attr("width",rwid)
	    .attr("height",rhei);
    }
    s.attr('stroke',color);
    s.attr('stroke-width',EXPECTED_STROKE_WIDTH);
    s.attr('opacity',opacity || EXPECTED_TRANSPARENCY);
    if(fill=='solid'){
	s.attr('fill',color);
    } else if(fill=='hollow'){
	s.attr('fill','white');
    } else if(fill=='striped'){
	s.attr('style','fill: url(#stripe_'+ id_name +'); stroke: '+color+'; opacity:'+EXPECTED_TRANSPARENCY+';');
    }

    return s;
}


function range(begin, end){
    var l=[];
    for (var i = begin; i < end; ++i){
	l.push(i);
    }
    return l;
}

function reduce(combine, base, array) {
    array.forEach(function (element) {
	    base = combine(base, element);
	});
    return base;
}

function add(x, y) {
    return x+y;
}

function sum(numbers) {
    return numbers.reduce(add,0);
}

function INVERSE_FEATURE_LOOKUP(context,val){
    var ret = INVERSE_FEATURE_LIST[[CONTEXTS[context],val]];
    return isNumber(ret)?ret:-1;
}

//id_num is type_id!!!
function get_prob(context,id_num,log,theta){
    var ret = 0; var print=0;
    var theta = theta || THETA;
    //    console.log('theta is ');
    //console.log(THETA);
    var data= DATA_BY_CONTEXT[context][id_num];
    if(print){
	console.log(DATA_BY_CONTEXT[context]);
	console.log(id_num);
	console.log(data);
    }
    for(var i=0;i<data.length;i++){
	var ifl=INVERSE_FEATURE_LOOKUP(context,data[i]);
	if(ifl>=0){
	    ret += theta[ifl]*THETA_STRENGTH[ifl];
	}
    }
    if(print){
	console.log('unnorm prob: '+Math.exp(ret));
	console.log('------------');
    }
    return log?ret:Math.exp(ret);
}

function get_expected_count(context,id_num){
    var prob = get_prob(context,id_num)/Z_THETA[context];
    return prob*NUM_TOKENS_C[context];
}

function redrawAllExpected(){
    for(var c=0;c<CONTEXTS.length;c++){
	var obs_in_c=TYPE_OBSERVATIONS_IN_C[c];
	//go through type IDs
	for(var i=0;i<obs_in_c.length;i++){
	    var id_num=obs_in_c[i];
	    drawExpectedData(c,id_num, d3.select('#observed_point_context_'+c+'_'+id_num));
	}
    }
}

//container needs to be acquired via a d3.select operation!!
function drawExpectedData(context, i, container){
    var group;		
    var vis = VISUALS[context][i];
    var fill=vis['fill'];
    var shapen = vis['shape'];
    var obs_count = COUNTS[context][i];
    var exp_count = EXPECTED_COUNTS[context][i];
    var color=determine_color(obs_count,exp_count);
    //scale by the max observed count...
    var max_count=-1;
    for(var other in COUNTS[context]){
	if(COUNTS[context][other] > max_count){
	    max_count=COUNTS[context][other];
	}
    }
    if(! $("exp_count_pic_"+context+'_'+i)){
	var exp_count_pic = createD3Shape(container,i,'exp_count_pic_'+context+'_'+i,SVG_WIDTH,SVG_HEIGHT,shapen,color,fill,exp_count,max_count);
	exp_count_pic.attr('id','exp_count_pic_'+context+'_'+i);
    } else{
	//otherwise, update it...
	updateD3Shape(container,i,'exp_count_pic_'+context+'_'+i,SVG_WIDTH,SVG_HEIGHT,shapen,color,fill,exp_count,max_count);
    }
}

function updateObservedImages(){
    var g=$$('.observed_count');
    var mcpc = [];
    for(var i=0;i<g.length;i++){
	//#observed_point_context_X_Y
	var s=g[i].id.split('_');
	var c = s[3] ; //get context -- X
	var j = s[4] ; //get type_id -- Y
	var count = COUNTS[c][j];
	if(mcpc[c]==undefined){
	    //get max count
	    mcpc[c]=-1;
	    for(var k in COUNTS[c]){
		mcpc[c]=Math.max(mcpc[c],COUNTS[c][k]);
	    }
	}
	var s=updateD3Shape(d3.select('#observed_point_context_'+c+'_'+j),j,'obs_count_pic_'+c+'_'+j,SVG_WIDTH,SVG_HEIGHT,VISUALS[c][j]['shape'],'gray','hollow',count,mcpc[c]);
	s.attr('stroke-opacity',1).attr('stroke-width',3);
	$('obs_count_text_'+i).innerHTML=count;
    }
    //var fill=rev[2]; var shapen = rev[0];
    //var count = SORT_COUNT_INDICES[MAP_COUNT_INDICES[i]][0];
}

function is_int(value){ 
    if((parseFloat(value) == parseInt(value)) && !isNaN(value)){
	return true;
    } else { 
	return false;
    } 
}

function update_token_count(){
    var c = parseInt(this.getAttribute('context'));
    var old_val=NUM_TOKENS_C[c];
    if(is_int(this.value)){
	var nval=parseInt(this.value);
	NUM_TOKENS-= old_val;
	NUM_TOKENS += nval;
	console.log(NUM_TOKENS_C[c]+', '+old_val+', '+nval);
	NUM_TOKENS_C[c] = NUM_TOKENS_C[c] - old_val;
	console.log(NUM_TOKENS_C);
	NUM_TOKENS_C[c] = NUM_TOKENS_C[c] + nval;
	console.log(NUM_TOKENS_C);
    } else{
	this.value=old_val;
    }
}

function drawSVGBoxes(selectObj){
    var nf=0;
    var max_num_rows=-1;
    var id=0;
    var width=SVG_WIDTH; var height=SVG_HEIGHT;
    var svg_offset=8; var offset=2*svg_offset + 3;
    var num_axes=0;
    for(var c=0;c<CONTEXTS.length;c++){
	console.log('beginning to draw area for '+c+', '+CONTEXTS[c]);
	var vis_in_c=VISUALS[c];
	var axes={}; var place_in_axis={};
	var div_context=document.createElement('div');
	div_context.id='context_draw_area_'+c;
	selectObj.appendChild(div_context);
	selectObj.appendChild(document.createElement('br'));
	selectObj.appendChild(document.createElement('hr'));
	selectObj.appendChild(document.createElement('br'));
	/*for(var v in vis_in_c){
	    for(var vv in vis_in_c[v]){
		if(axes[vv]==undefined){
		    axes[vv]={};
		    num_axes++;
		    place_in_axis[vv]={};
		}
		axes[vv][vis_in_c[v][vv]]=1;
		place_in_axis[vv][v]=vis_in_c[v][vv];
	    }
	}
	console.log('axes ');

	console.log(axes);
	console.log(place_in_axis);*/

	var highest_row_cols=[-1,-1];
	for(var position_pair in POSITION_BY_CONTEXT[c]){
	    var pp = position_pair.split(',').map(function(d){return parseInt(d);});
	    for(var i=0;i<pp.length;i++){
		highest_row_cols[i]= (pp[i]>highest_row_cols[i])?pp[i]:highest_row_cols[i];
	    }
	}
	var num_rows = highest_row_cols[0]+1;
	var num_cols = highest_row_cols[1]+1;
	var npr=num_cols;
	//var npr=NUM_PER_ROW;
	//set the number of items per row (npr)
	//npr = NUM_OBSERVATIONS_C[c]/num_rows<1 ? NUM_OBSERVATIONS_C[c] : Math.ceil(NUM_OBSERVATIONS_C[c]/num_rows);
	selectObj.style.width = npr * width + (npr*offset)+'px';
	selectObj.style.overflow='hidden';
		
	for(var i=0;i<num_rows;i++){
	    var divi=document.createElement('div');
	    divi.style.width='inherit';
	    div_context.appendChild(divi);
	    for(var j=0;j<npr; j++){
		//get type id
		var type_id = POSITION_BY_CONTEXT[c][[i,j]];
		//always make a div, no matter what
		var divj=document.createElement('div');
		divj.style.overflow='hidden';
		divi.appendChild(divj);
		divj.style.padding = '2px 4px 0px 4px';
		divj.style.border = '1px solid gray';
		if(j+1 < npr){
		    divj.style.cssFloat='left';
		}
		divj.style.width = (width+svg_offset)+'px';
		
		//but then we may not have actually observed anything for this type id
		//that is, we may not have observed the full joint
		if(type_id==undefined){
		    continue;
		} 
		var features_for_type_id = TYPE_INDEX[type_id];
		//create the count text reps
		var obs_count_p = document.createElement('p');
		var obs_count= COUNTS[c][type_id];
		obs_count_p.innerHTML = obs_count;
		obs_count_p.style.display='inline';
		obs_count_p.id = 'obs_count_text_'+type_id;
		obs_count_p.className += ' count_text observed_count_text';
		var divk=document.createElement('div');
		divk.appendChild(obs_count_p);

		var exp_count_p = document.createElement('p');
		
		//ZZZ 
		var ecp=get_expected_count(c,type_id);
		exp_count_p.innerHTML = ecp.toFixed(2);
		exp_count_p.setAttribute('value',ecp);
		exp_count_p.style.display='inline';
		exp_count_p.setAttribute('dirty',1);
		exp_count_p.id = 'exp_count_text_'+type_id;
		exp_count_p.className += ' count_text expected_count_text';
		var color=determine_color(obs_count,ecp);
		var vis = VISUALS[c][type_id];
		var fill=vis['fill'];
		exp_count_p.style.color=color;
		var shapen = vis['shape'];
		divk.appendChild(exp_count_p);
		divj.appendChild(divk);

		//and now the image
		var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
		svg.setAttribute('class',svg.className+' observed_count '+ ['fill','shape'].map(function(e,i){ return "feature_"+e+"_"+vis[e];}).join(' '));
		svg.setAttribute('id','observed_point_context_'+c+'_'+type_id);
		svg.setAttribute('width',width);
		svg.setAttribute('height',height);
		divj.appendChild(svg);
		svg = d3.select('#observed_point_context_'+c+'_'+type_id);
		var max_count=-1;
		for(var other in COUNTS[c]){
		    if(COUNTS[c][other] > max_count){
			max_count=COUNTS[c][other];
		    }
		}
		var shape = createD3Shape(svg, type_id, 'obs_count_pic_'+c+'_'+type_id, width,height,shapen,'gray','hollow',obs_count,max_count,1);
		shape.attr('stroke-opacity',1).attr('stroke-width',3);
		shape.attr('id','obs_count_pic_'+c+'_'+type_id);
	    } //end for over columns
	    divi.className += ' drawrow';
	}
    }
}


//http://stackoverflow.com/questions/3730510/javascript-sort-array-and-return-an-array-of-indicies-that-indicates-the-positi
function sortWithIndeces(toSort) {
    for (var i = 0; i < toSort.length; i++) {
	toSort[i] = [toSort[i], i];
    }
    toSort.sort(function(left, right) {
	    return left[0] < right[0] ? -1 : 1;
	});
    toSort.sortIndices = [];
    for (var j = 0; j < toSort.length; j++) {
	toSort.sortIndices.push(toSort[j][1]);
	//	toSort[j] = toSort[j][0];
    }
    return toSort;
}



