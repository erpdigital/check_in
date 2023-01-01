$(document).ready(function(){




    function check_in() {
        frappe.show_progress('Check In..', 70, 100, 'Please wait', hide_on_completion = true);
        frappe.call('check_in.api.check_in', {     })
          .then(r => {     
          app = document.getElementById('checkin')  
          app.innerHTML = 'Check Out';
          app.onclick = function(){check_out();}
          app.classList= "btn btn-info"
          frappe.show_progress('Check In..', 100, 100, 'Please wait', hide_on_completion = true);

        })
      }
      
      function check_out() {
        frappe.show_progress('Check Out..', 70, 100, 'Please wait', hide_on_completion = true);
        frappe.call('check_in.api.check_out', {})
          .then(r => {     
          app = document.getElementById('checkin')  
          app.innerHTML = 'Check In';
          app.classList= "btn btn-info"
          app.onclick =function(){check_in();}
          frappe.show_progress('Check Out..', 100, 100, 'Please wait', hide_on_completion = true);
        });
    }


	frappe.call('check_in.api.get_status',{})
	.then(r => {  		  
       
        var app = document.createElement('button');
        app.id = 'checkin'
        app.classList= "btn btn-info"
        if (r.message == "OUT"){
            app.innerHTML = 'Check In';
            app.onclick = function(){check_in();}
        } else {
            app.innerHTML = 'Check Out';
            app.onclick = function(){check_out();}
        }
         
	 $('header.navbar > .container > .navbar-collapse > ul.navbar-nav').prepend(app); 
    
    
    
    
    });
  
   

     
});