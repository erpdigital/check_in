$(document).ready(function(){
  
  const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let time = date.toLocaleTimeString();


    // This arrangement can be altered based on how we want the date's format to appear.
    let currentDate = `${day}-${month}-${year}`;
    document.getElementById("now").innerText = "Today is:" + currentDate +" " + time;


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
      document.getElementById('name').innerText = result.employee_name;
      document.getElementById("image").src = 'http://site.localhost:8000' + result.image;
      const date = new Date().toLocaleTimeString();
      (log_type == "IN") ? document.getElementById("check").innerText = "Check In Time "+ date : document.getElementById("check").innerText = "Check Out Time "+ date;
      (log_type == "OUT")? document.getElementById("totalHours").innerText= " Worked total hours:" + result.totalHours: "";
      $("#employee").show();
    }
    
    // TODO function for date

  });