const date = new Date();
$("#card-container").hide();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    // This arrangement can be altered based on how we want the date's format to appear.
    let currentDate = `${day}-${month}-${year}`;
    document.getElementById("now").innerText = "Today is:" + currentDate;
    onscan.attachTo(document, {
      onScan: function (sScancode) {
        console.log(sScancode)
        frappe.call({
          method: "check_in.api.get_status",
          args: {
            attendance_id: sScancode
          },
          callback: function (r) {
            if (r.message == "OUT") {
              console.log('SOUT');
              check_in(sScancode);
            }
            if (r.message == "IN") {
              console.log('SIN');
              check_out(sScancode);
            }
          }
        });
  
      }
    });
  
    var paragraph = document.getElementById("p1")
  
    function check_in(attendance_id) {
      frappe.call({
        method: "check_in.api.check_in",
        args: {
          attendance_id: attendance_id
        },
        callback: function (r) {
          if (r.message) {
  
            console.log(r.message)
            populate(r.message)
          }
        }
      });
    }
  
    function populate(message) {
  
      document.getElementById('name').innerText = message[0]
      document.getElementById("image").src = 'http://site.localhost:8000' + message[1]
      if (message[2] === 'IN') {
        document.getElementById('last').innerText = 'Last check-in at: ' + message[3]
        document.getElementById('check').innerText = "Check In"
      }
      else {
        document.getElementById('last').innerText = 'Last check-out at: ' + message[3]
        document.getElementById('check').innerText = "Check out"
      }
    }
  
    function check_out(attendance_id) {
      frappe.call({
        method: "check_in.api.check_out",
        args: {
          attendance_id: attendance_id
        },
        callback: function (r) {
          if (r.message) {
  
            console.log(r.message)
            populate(r.message)
          }
        }
      });
    }

   