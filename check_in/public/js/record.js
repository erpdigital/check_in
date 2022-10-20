$(document).ready(function(){
  
  const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let time = date.toLocaleTimeString();
    // This arrangement can be altered based on how we want the date's format to appear.
    let currentDate = `${day}-${month}-${year}`;
    document.getElementById("current_date").innerText = "Today is:" + currentDate;
    document.getElementById("current_time").innerText = "Time is:" + time;


    onscan.attachTo(document,
    {
      onScan: function (sScancode){
          frappe.call('check_in.api.get_status',{attendance_id: sScancode})
          .then(r => {  (r.message == "OUT") ? check_in(sScancode) : check_out(sScancode) })
        }
    });
  
    function check_in(attendance_id) {
      frappe.call('check_in.api.check_in', { attendance_id: attendance_id    })
        .then(r => { populate(r.message, "IN")
      })
    }
    
    function check_out(attendance_id) {
      frappe.call('check_in.api.check_out', { attendance_id: attendance_id    })
        .then(r => { populate(r.message, "OUT")
      })
    }




    function populate(message, log_type) {
      var result = JSON.parse(message);
      document.getElementById('employee_name').innerText = result.employee_name;
      document.getElementById('employee_designation').innerText = result.designation;
      document.getElementById("employee_image").src = 'http://site.localhost:8000' + result.image;
      const date = new Date().toLocaleTimeString();
     (log_type == "IN") ? document.getElementById("checkin").innerText = "Check In Time "+ date : document.getElementById("checkin").innerText = "Check Out Time "+ date;
      (log_type == "OUT")? document.getElementById("total_time").innerText= " Worked total hours:" + result.totalHours: document.getElementById("total_time").innerText="";
      (log_type == "OUT")? document.getElementById("greeting").innerText= "Good bye!" :  document.getElementById("greeting").innerText= "Hello";
      $("#welcome_block").hide();
      $("#checkin_block").show();
    }
    
    // TODO function for date

  });