$(document).ready(function(){
  
    function check_in() {
        frappe.call('check_in.api.check_in', {     })
          .then(r => {      app.innerHTML = 'Check Out';
          app.onclick = function(){check_out();}
          app.classList= "btn btn-info"
          window.location.reload();
        })
      }
      
      function check_out() {
        frappe.call('check_in.api.check_out', {})
          .then(r => {       app.innerHTML = 'Check In';
          app.classList= "btn btn-info"
          app.onclick =function(){check_in();}
          window.location.reload();
        });
    }


	frappe.call('check_in.api.get_status',{})
	.then(r => {  		  
       
        var app = document.createElement('button');
        if (r.message == "OUT"){
            app.innerHTML = 'Check In';
            app.classList= "btn btn-info"
            app.onclick = function(){check_in();}
        } else {
            app.innerHTML = 'Check Out';
            app.classList= "btn btn-info"
            app.onclick = function(){check_out();}
        }
        
	 $('header.navbar > .container > .navbar-collapse > ul.navbar-nav').prepend(app); 
    
    
    
    
    });
  
   

     
});