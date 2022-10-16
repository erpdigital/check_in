from ast import Eq
from datetime import timedelta

import frappe
from erpnext.hr.doctype.employee_checkin.employee_checkin import \
    calculate_working_hours
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_link_to_form, now_datetime, nowdate
from frappe.utils.data import nowdate


@frappe.whitelist()
def get_employee(attendance_id="123"):
    """
    Return employee id
    :param email: employee company email id
    """
    try:
        employee_details = frappe.db.sql("""
			SELECT name, employee_name,company FROM `tabEmployee` WHERE
			user_id = '{0}' or company_email='{0}'
			""".format(frappe.session.user), as_dict=1)
        employee, name, company, image = frappe.db.get_value("Employee", {
                                                             'attendance_device_id': attendance_id}, ["name", "employee_name", "company", "image"])
    # frappe.msgprint(frappe.session.user)
        return employee, name, company, image
    except ValueError:
        return "HI"


@frappe.whitelist()
def check_in(attendance_id='B07ZYJG7KF'):

    employee, name, company, image = get_employee(attendance_id)
    doc = frappe.new_doc("Employee Checkin")
    doc.employee = employee
    doc.employee_name = name
    doc.time = now_datetime()
    doc.device_id = attendance_id
    doc.log_type = "IN"
    doc.insert()
    frappe.db.commit()
    set_attendance(doc, attendance_id, "IN")
    log, time1 = last_check(attendance_id)
    time1 = j_serial(time1)
    result = [employee, image, log, time1]

    # frappe.msgprint"IN"+str(doc.employee_name))
    return result


def j_serial(o):     # self contained
    from datetime import date, datetime
    return str(o).split('.')[0] if isinstance(o, (datetime, date)) else None


def last_check(attendance_id):
    log, time1 = "", ""
    exists = frappe.db.exists('Employee Checkin', {'device_id': attendance_id})
    if exists:
        log, time1 = frappe.db.get_value(
            'Employee Checkin', {'device_id': attendance_id}, ["log_type", "time"])
        return log, time1

    return log, time1


@frappe.whitelist()
def check_out(attendance_id='B07ZYJG7KF'):

    employee, name, company, image = get_employee(attendance_id)
    doc = frappe.new_doc("Employee Checkin")
    doc.employee = employee
    doc.employee_name = name
    doc.time = now_datetime()
    doc.device_id = attendance_id
    doc.log_type = "OUT"
    doc.insert()

    frappe.db.commit()
    set_attendance(doc, attendance_id, "OUT", get_checkin_checkout(attendance_id))

    log, time1 = last_check(attendance_id)
    time1 = j_serial(time1)
    result = [employee, image, log, time1, get_checkin_checkout(attendance_id)]

    return result


@frappe.whitelist()
def get_status(attendance_id='B07ZYJG7KF'):
    employee, name, company, image = get_employee(attendance_id)
    exists = frappe.db.exists(
        'Attendance', {"employee": employee, "attendance_date": nowdate()})
    if exists:
        doc = frappe.db.get_value(
            'Employee Checkin', {'device_id': attendance_id}, "log_type")
        return doc
    else:
        return "OUT"


@frappe.whitelist()
def get_checkin_checkout(attendance_id):
    employee, name, company, image = get_employee(attendance_id)

    doc = frappe.db.get_list("Employee Checkin", filters={
        'creation': ['>=', nowdate()],
        'employee': employee


    }, fields=['time', 'log_type'],
        order_by='time desc')
    check_in_out_type = [
        "Alternating entries as IN and OUT during the same shift"]
    working_hours_calc_type = ["Every Valid Check-in and Check-out"]
    if len(doc) >= 1:
        work_hour = calculate_working_hours(
            doc, check_in_out_type[0], working_hours_calc_type[0])
    else:
        work_hour = 0
    return work_hour


def set_attendance(doc, attendance_id, type, working_hours=0, shift="Day"):
    employee, name, company, image = get_employee(attendance_id)
    duplicate = frappe.db.exists(
        "Attendance",
        {"employee": employee, "attendance_date": nowdate(),
         "docstatus": ("!=", "2")},
    )

    if not duplicate:
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
        return attendance.name
    if type == "OUT":
        attedance_name = frappe.db.get_value(
            "Attendance", {'employee': employee, "attendance_date": nowdate()}, "name")
        doc.attendance = attedance_name
        doc.save()
        frappe.db.set_value('Attendance', attedance_name, {
            'out_time':  now_datetime(),
            'working_hours': working_hours})
        frappe.db.commit()
        return attedance_name
    else:
        attedance_name = frappe.db.get_value(
            "Attendance", {'employee': employee, "attendance_date": nowdate()}, "name")
        doc.attendance = attedance_name
        doc.save()
        frappe.db.set_value('Attendance', attedance_name, {

            'working_hours': working_hours})
        frappe.db.commit()
        return attedance_name


def mark_attendance_and_link_log(
        logs,
        attendance_status,
        attendance_date,
        working_hours=None,
        late_entry=False,
        early_exit=False,
        in_time=None,
        out_time=None,
        shift=None,
):
    """Creates an attendance and links the attendance to the Employee Checkin.
    Note: If attendance is already present for the given date, the logs are marked as skipped and no exception is thrown.

    :param logs: The List of 'Employee Checkin'.
    :param attendance_status: Attendance status to be marked. One of: (Present, Absent, Half Day, Skip). Note: 'On Leave' is not supported by this function.
    :param attendance_date: Date of the attendance to be created.
    :param working_hours: (optional)Number of working hours for the given date.
    """
    log_names = [x.name for x in logs]
    employee = logs[0].employee
    if attendance_status == "Skip":
        skip_attendance_in_checkins(log_names)
        return None

    elif attendance_status in ("Present", "Absent", "Half Day"):
        company = frappe.get_cached_value("Employee", employee, "company")
        duplicate = frappe.db.exists(
            "Attendance",
            {"employee": employee, "attendance_date": attendance_date,
             "docstatus": ("!=", "2")},
        )

        if not duplicate:
            doc_dict = {
                "doctype": "Attendance",
                "employee": employee,
                "attendance_date": attendance_date,
                "status": attendance_status,
                "working_hours": working_hours,
                "company": company,
                "shift": shift,
                "late_entry": late_entry,
                "early_exit": early_exit,
                "in_time": in_time,
                "out_time": out_time,
            }
            attendance = frappe.get_doc(doc_dict).insert()
            attendance.submit()

            if attendance_status == "Absent":
                attendance.add_comment(
                    text=_(
                        "Employee was marked Absent for not meeting the working hours threshold.")
                )

            frappe.db.sql(
                """update `tabEmployee Checkin`
				set attendance = %s
				where name in %s""",
                (attendance.name, log_names),
            )
            return attendance
        else:
            skip_attendance_in_checkins(log_names)
            if duplicate:
                add_comment_in_checkins(log_names, duplicate)

            return None
    else:
        frappe.throw(
            _("{} is an invalid Attendance Status.").format(attendance_status))


def calculate_working_hours(logs, check_in_out_type, working_hours_calc_type):
    """Given a set of logs in chronological order calculates the total working hours based on the parameters.
    Zero is returned for all invalid cases.

    :param logs: The List of 'Employee Checkin'.
    :param check_in_out_type: One of: 'Alternating entries as IN and OUT during the same shift', 'Strictly based on Log Type in Employee Checkin'
    :param working_hours_calc_type: One of: 'First Check-in and Last Check-out', 'Every Valid Check-in and Check-out'
    """
    total_hours = 0

    in_time = out_time = None
    if check_in_out_type == "Alternating entries as IN and OUT during the same shift":
        in_time = logs[0].time
        if len(logs) >= 2:
            out_time = logs[-1].time
        if working_hours_calc_type == "Every Valid Check-in and Check-out":
            logs = logs[:]
            while len(logs) >= 2:
                total_hours += time_diff_in_hours(logs[0].time, logs[1].time)
                del logs[:2]

    return total_hours


def time_diff_in_hours(start, end):
    time = -1*round((end - start).total_seconds() / 3600, 1)
    print(start, end, time)
    return time


def find_index_in_dict(dict_list, key, value):
    return next((index for (index, d) in enumerate(dict_list) if d[key] == value), None)


def add_comment_in_checkins(log_names, duplicate):
    text = _("Auto Attendance skipped due to duplicate attendance record: {}").format(
        get_link_to_form("Attendance", duplicate)
    )

    for name in log_names:
        frappe.get_doc(
            {
                "doctype": "Comment",
                "comment_type": "Comment",
                "reference_doctype": "Employee Checkin",
                "reference_name": name,
                "content": text,
            }
        ).insert(ignore_permissions=True)


def skip_attendance_in_checkins(log_names):
    EmployeeCheckin = frappe.qb.DocType("Employee Checkin")
    (
        frappe.qb.update(EmployeeCheckin)
        .set("skip_auto_attendance", 1)
        .where(EmployeeCheckin.name.isin(log_names))
    ).run()
