from ast import Eq, Str
from datetime import timedelta
from typing import List

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form, now_datetime, nowdate
from frappe.utils.data import nowdate

from check_in.constants import *


@frappe.whitelist()
def get_employee(attendance_id):
    """
    Return employee, name, company, designation, default_shift, image 
    :param attendance_id
    """

    # employee_details = frappe.db.sql("""
    # 	SELECT name, employee_name,company FROM `tabEmployee` WHERE
    # 	user_id = '{0}' or company_email='{0}'
    # 	""".format(frappe.session.user), as_dict=1)

    employee, name, company, designation, default_shift, image = frappe.db.get_value("Employee", {'attendance_device_id': attendance_id},
                                                                                     ["name", "employee_name", "company", "designation", "default_shift", "image"])
    return employee, name, company, designation, default_shift, image


@frappe.whitelist()
def check_in(attendance_id):

    employee, name, company, designation, default_shift, image = get_employee(
        attendance_id)

    doc = frappe.new_doc("Employee Checkin")
    doc.employee = employee
    doc.employee_name = name
    doc.time = now_datetime()
    doc.device_id = attendance_id
    doc.log_type = EMPLOYEE_LOG_TYPE_IN
    doc.insert()
    frappe.db.commit()

    set_attendance(doc, attendance_id, EMPLOYEE_LOG_TYPE_IN)
    result = [employee, image, company, designation]

    return result


@frappe.whitelist()
def check_out(attendance_id):

    employee, name, company, image = get_employee(attendance_id)
    doc = frappe.new_doc("Employee Checkin")
    doc.employee = employee
    doc.employee_name = name
    doc.time = now_datetime()
    doc.device_id = attendance_id
    doc.log_type = EMPLOYEE_LOG_TYPE_OUT
    doc.insert()

    frappe.db.commit()
    set_attendance(doc, attendance_id, EMPLOYEE_LOG_TYPE_OUT,
                   get_working_hours(attendance_id))

    result = [employee, image, get_working_hours(attendance_id)]

    return result


@frappe.whitelist()
def get_status(attendance_id):
    employee, name, company, image = get_employee(attendance_id)
    is_attendance_exist = frappe.db.exists(
        'Attendance', {"employee": employee, "attendance_date": nowdate()})

    if is_attendance_exist:
        doc = frappe.db.get_value(
            'Employee Checkin', {'device_id': attendance_id}, "log_type")
        return doc
    else:
        return EMPLOYEE_LOG_TYPE_OUT


def get_working_hours(attendance_id):
    employee = get_employee(attendance_id)
    doc = frappe.db.get_list("Employee Checkin", filters={'creation': ['>=', nowdate()], 'employee': employee},
                             fields=['time', 'log_type'], order_by='time desc')

    working_hours = calculate_working_hours(doc, EMPLOYEE_WORK_HRS_COMP_TYPE)
    return working_hours


def set_attendance(doc, attendance_id, type, working_hours, shift):
    employee, company = get_employee(attendance_id)
    is_exist = frappe.db.exists("Attendance", {
                                "employee": employee, "attendance_date": nowdate(), "docstatus": ("!=", "2")})

    if not is_exist:
        doc_dict = {
            "doctype": "Attendance",
            "employee": employee,
            "attendance_date": nowdate(),
            "status": "Present",
            "company": company,
            "shift": shift,
            "in_time": now_datetime(),
        }

        attendance = frappe.get_doc(doc_dict).insert()
        attendance.submit()
        doc.attendance = attendance.name
        doc.save()
        frappe.db.commit()
    else:
        if type == EMPLOYEE_LOG_TYPE_OUT:
            attedance_name = frappe.db.get_value(
                "Attendance", {'employee': employee, "attendance_date": nowdate()}, "name")
            doc.attendance = attedance_name
            doc.save()

            frappe.db.set_value('Attendance', attedance_name, {
                                'out_time':  now_datetime(), 'working_hours': working_hours})
            frappe.db.commit()
        else:
            attendance_name = frappe.db.get_value(
                "Attendance", {'employee': employee, "attendance_date": nowdate()}, "name")
            doc.attendance = attendance_name
            doc.save()

            frappe.db.set_value('Attendance', attedance_name, {
                                'working_hours': working_hours})
            frappe.db.commit()


def calculate_working_hours(logs, working_hours_calc_type):
    """
    :param logs: The List of 'Employee Checkin'.
    :param working_hours_calc_type: Every Valid Check-in and Check-out
    """
    total_hours = 0

    if working_hours_calc_type == EMPLOYEE_WORK_HRS_COMP_TYPE:
        logs = logs[:]
        while len(logs) >= 2:
            total_hours += time_diff_in_hours(logs[0].time, logs[1].time)
            del logs[:2]
    return total_hours


def time_diff_in_hours(start, end):
    time = -1 * round((end - start).total_seconds() / 3600, 1)
    return time
