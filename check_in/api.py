from ast import Eq, Str
from datetime import timedelta
import imp
from typing import List

from check_in.backend.employee_timerecord import *
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form, now_datetime, nowdate
from frappe.utils.data import nowdate

from check_in.backend.constants import *

#attendance_id for testing assigned, will remove
@frappe.whitelist()
def check_in(attendance_id=0):
    employee_timerecord = EmployeeTimeRecord(attendance_id=attendance_id, type=EMPLOYEE_LOG_TYPE_IN)
    return employee_timerecord.make()
    

@frappe.whitelist()
def check_out(attendance_id=0):
    employee_timerecord = EmployeeTimeRecord(attendance_id=attendance_id, type=EMPLOYEE_LOG_TYPE_OUT)
    return employee_timerecord.make()


@frappe.whitelist()
def get_status(attendance_id=0):
    employee_timerecord = EmployeeTimeRecord(attendance_id=attendance_id,type='')
    return employee_timerecord.check_status()
