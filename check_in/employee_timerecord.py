import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form, now_datetime, nowdate
from frappe.utils.data import nowdate


class EmployeeTimeRecord:
    def __init__(self, attendance_id) -> None:
        self.attendance_id = attendance_id
        self.make()

    def make(self):
        pass

    def get_employee(self):
        employee, name, company, designation, default_shift, image = frappe.db.get_value("Employee", {'attendance_device_id': self.attendance_id},
                                                                                         ["name", "employee_name", "company", "designation", "default_shift", "image"])
        return employee, name, company, designation, default_shift, image
