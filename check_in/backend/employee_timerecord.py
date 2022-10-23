import frappe
import json
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form, now_datetime, nowdate
from frappe.utils.data import nowdate
from check_in.backend.constants import *
from check_in.backend.model import *
from datetime import timedelta


class EmployeeTimeRecord:
    def __init__(self, attendance_id, type) -> None:
        self.attendance_id = attendance_id
        self.type = type

    def make(self):
        return self.make_checkin() if (self.type == EMPLOYEE_LOG_TYPE_IN) else self.make_checkout()

    def make_checkin(self):
        self.get_employee()
        self.set_check_in()
        self.get_working_hours()
        self.set_attendance()
        result = self.employee._asdict()
        result['totalHours'] = self.working_hours
        return json.dumps(result)

    def make_checkout(self):
        self.get_employee()
        self.set_check_out()
        self.get_working_hours()
        self.set_attendance()
        result = self.employee._asdict()
        result['totalHours'] = self.working_hours
        result['lastCheckin'] = self.last_checkin
        return json.dumps(result)

    def check_status(self):
        self.get_employee()
        return self.get_status()

    def get_last_checkin(self):
        self.last_checkin = vars(frappe.get_last_doc('Employee Checkin', filters={
                                           "device_id": self.attendance_id}))['time'].isoformat()
 
    def get_status(self):
        is_attendance_exist = frappe.db.exists(
            'Attendance', {"employee": self.employee.name, "attendance_date": nowdate()})
        if is_attendance_exist:
            doc = frappe.db.get_value(
                'Employee Checkin', {'device_id': self.attendance_id}, "log_type")
            return doc
        else:
            return EMPLOYEE_LOG_TYPE_OUT

  
    def get_employee(self):
        self.employee = frappe.db.get_value("Employee", {'attendance_device_id': self.attendance_id},
                                            ["name", "employee_name", "company", "designation", "default_shift", "image"])
        employee1, name, company, designation, shift, image = frappe.db.get_value("Employee", {'attendance_device_id': self.attendance_id},
                                                                                  ["name", "employee_name", "company", "designation", "default_shift", "image"])
        self.employee = ModelEmployee(
            employee1, name, company, designation, shift, image)

    def set_check_in(self):
        self.doc = frappe.new_doc("Employee Checkin")
        self.doc.employee = self.employee.name
        self.doc.employee_name = self.employee.employee_name
        self.doc.time = now_datetime()
        self.doc.device_id = self.attendance_id
        self.doc.log_type = EMPLOYEE_LOG_TYPE_IN
        self.doc.insert()

        doc1 = frappe.get_doc('Employee', self.employee.name)
        frappe.client.set_value('Employee',doc1.name,'online','Online')
        frappe.db.commit()

    def set_check_out(self):
        self.doc = frappe.new_doc("Employee Checkin")
        self.doc.employee = self.employee.name
        self.doc.employee_name = self.employee.employee_name
        self.doc.time = now_datetime()+timedelta(minutes=30)
        self.doc.device_id = self.attendance_id
        self.doc.log_type = EMPLOYEE_LOG_TYPE_OUT
        self.doc.insert()
        doc1 = frappe.get_doc('Employee', self.employee.name)
        frappe.client.set_value('Employee',doc1.name,'online','Offline')
        frappe.db.commit()
        frappe.db.commit()

    def get_working_hours(self):
        doc = frappe.db.get_list("Employee Checkin", filters={'creation': ['>=', nowdate()], 'employee': self.employee.name},
                                 fields=['time', 'log_type'], order_by='time desc')

        self.working_hours = self.calculate_working_hours(
            doc, EMPLOYEE_WORK_HRS_COMP_TYPE)

    def set_attendance(self):
        is_exist = frappe.db.exists("Attendance", {
            "employee": self.employee.name, "attendance_date": nowdate(), "docstatus": ("!=", "2")})
        if not is_exist:
            doc_dict = {
                "doctype": "Attendance",
                "employee": self.employee.name,
                "attendance_date": nowdate(),
                "status": "Present",
                "company": self.employee.company,
                "shift": self.employee.shift,
                "in_time": now_datetime(),
            }

            attendance = frappe.get_doc(doc_dict).insert()
            attendance.submit()
            self.doc.attendance = attendance.name
            self.doc.save()
            frappe.db.commit()
        else:
            if self.type == EMPLOYEE_LOG_TYPE_OUT:
                attendance_name = frappe.db.get_value(
                    "Attendance", {'employee': self.employee.name, "attendance_date": nowdate()}, "name")

                # Linking checkout doc to Attendance
                self.doc.attendance = attendance_name
                self.doc.save()

                frappe.db.set_value('Attendance', attendance_name, {
                    'out_time':  now_datetime(), 'working_hours': self.working_hours})
                frappe.db.commit()
            else:
                attendance_name = frappe.db.get_value(
                    "Attendance", {'employee': self.employee.name, "attendance_date": nowdate()}, "name")
                # Linking checkin doc to Attendance
                self.doc.attendance = attendance_name
                self.doc.save()

                frappe.db.set_value('Attendance', attendance_name, {
                    'working_hours': self.working_hours})
                frappe.db.commit()

    def calculate_working_hours(self, logs, working_hours_calc_type):
        """
        :param logs: The List of 'Employee Checkin'.
        :param working_hours_calc_type: Every Valid Check-in and Check-out
        """
        total_hours = 0
        if working_hours_calc_type == EMPLOYEE_WORK_HRS_COMP_TYPE:
            logs = logs[:]
            while len(logs) >= 2:
                total_hours += self.time_diff_in_hours(
                    logs[0].time, logs[1].time)
                del logs[:2]
        return total_hours

    def time_diff_in_hours(self, start, end):
        time = -1 * round((end - start).total_seconds() / 3600, 1)
        return time
