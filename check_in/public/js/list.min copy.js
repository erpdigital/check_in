(function () {
	'use strict';

	frappe.templates['listing'] = '<div class="frappe-list">  <div class="list-filters" style="display: none;">  </div>   <div style="margin-bottom:9px" class="list-toolbar-wrapper hide">   <div class="list-toolbar btn-group" style="display:inline-block; margin-right: 10px;">   </div>  </div>     <div style="clear:both"></div>  <div class="no-result text-center" style="display: none;">   {%= no_result_message %}  </div>  <div class="result">   <div class="list-headers"></div>         <div class="list-loading text-center">          {%= frappe.messages.get_waiting_message(__("Loading") + "..." ) %}         </div>   <div class="result-list"></div>  </div>  <div class="list-paging-area">   <div class="row">    <div class="col-xs-6">     <div class="btn-group btn-group-paging">      <button type="button" class="btn btn-default btn-sm btn-info" data-value="20">20</button>      <button type="button" class="btn btn-default btn-sm" data-value="100">100</button>      <button type="button" class="btn btn-default btn-sm" data-value="500">500</button>     </div>    </div>    <div class="col-xs-6 text-right">     <button class="btn btn-default btn-more btn-sm">{%= _more %}...</button>    </div>   </div>  </div> </div> ';

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors

	frappe.has_indicator = function(doctype) {
		// returns true if indicator is present
		if(frappe.model.is_submittable(doctype)) {
			return true;
		} else if((frappe.listview_settings[doctype] || {}).get_indicator
			|| frappe.workflow.get_state_fieldname(doctype)) {
			return true;
		} else if(frappe.meta.has_field(doctype, 'enabled')
			|| frappe.meta.has_field(doctype, 'disabled')) {
			return true;
		}
		return false;
	};

	frappe.get_indicator = function(doc, doctype) {
		if(doc.__unsaved) {
			return [__("Not Saved"), "orange"];
		}

		if(!doctype) { doctype = doc.doctype; }

		var workflow = frappe.workflow.workflows[doctype];
		var without_workflow = workflow ? workflow['override_status'] : true;

		var settings = frappe.listview_settings[doctype] || {};

		var is_submittable = frappe.model.is_submittable(doctype),
			workflow_fieldname = frappe.workflow.get_state_fieldname(doctype);

		// workflow
		if(workflow_fieldname && !without_workflow) {
			var value = doc[workflow_fieldname];
			if(value) {
				var colour = "";

				if(locals["Workflow State"][value] && locals["Workflow State"][value].style) {
					var colour = {
						"Success": "green",
						"Warning": "orange",
						"Danger": "red",
						"Primary": "blue",
						"Inverse": "black",
						"Info": "light-blue",
					}[locals["Workflow State"][value].style];
				}
				if (!colour) { colour = "gray"; }

				return [__(value), colour, workflow_fieldname + ',=,' + value];
			}
		}

		// draft if document is submittable
		if(is_submittable && doc.docstatus==0 && !settings.has_indicator_for_draft) {
			return [__("Draft"), "red", "docstatus,=,0"];
		}

		// cancelled
		if(is_submittable && doc.docstatus==2 && !settings.has_indicator_for_cancelled) {
			return [__("Cancelled"), "red", "docstatus,=,2"];
		}

		if(settings.get_indicator) {
			var indicator = settings.get_indicator(doc);
			if(indicator) { return indicator; }
		}

		// if submittable
		if(is_submittable && doc.docstatus==1) {
			return [__("Submitted"), "blue", "docstatus,=,1"];
		}

		// based on status
		if(doc.status) {
			return [__(doc.status), frappe.utils.guess_colour(doc.status)];
		}

		// based on enabled
		if(frappe.meta.has_field(doctype, 'enabled')) {
			if(doc.enabled) {
				return [__('Enabled'), 'blue', 'enabled,=,1'];
			} else {
				return [__('Disabled'), 'grey', 'enabled,=,0'];
			}
		}

		// based on disabled
		if(frappe.meta.has_field(doctype, 'disabled')) {
			if(doc.disabled) {
				return [__('Disabled'), 'grey', 'disabled,=,1'];
			} else {
				return [__('Enabled'), 'blue', 'disabled,=,0'];
			}
		}
	};

	frappe.ui.Filter = class {
		constructor(opts) {
			$.extend(this, opts);
			if (this.value === null || this.value === undefined) {
				this.value = '';
			}

			this.utils = frappe.ui.filter_utils;
			this.set_conditions();
			this.set_conditions_from_config();
			this.make();
		}

		set_conditions() {
			var ref;

			this.conditions = [
				['=', __('Equals')],
				['!=', __('Not Equals')],
				['like', __('Like')],
				['not like', __('Not Like')],
				['in', __('In')],
				['not in', __('Not In')],
				['is', __('Is')],
				['>', '>'],
				['<', '<'],
				['>=', '>='],
				['<=', '<='],
				['Between', __('Between')],
				['Timespan', __('Timespan')] ];

			this.nested_set_conditions = [
				['descendants of', __('Descendants Of')],
				['not descendants of', __('Not Descendants Of')],
				['ancestors of', __('Ancestors Of')],
				['not ancestors of', __('Not Ancestors Of')] ];

			(ref = this.conditions).push.apply(ref, this.nested_set_conditions);

			this.invalid_condition_map = {
				Date: ['like', 'not like'],
				Datetime: ['like', 'not like'],
				Data: ['Between', 'Timespan'],
				Select: ['like', 'not like', 'Between', 'Timespan'],
				Link: ['Between', 'Timespan', '>', '<', '>=', '<='],
				Currency: ['Between', 'Timespan'],
				Color: ['Between', 'Timespan'],
				Check: this.conditions.map(function (c) { return c[0]; }).filter(function (c) { return c !== '='; }),
			};
		}

		set_conditions_from_config() {
			if (frappe.boot.additional_filters_config) {
				this.filters_config = frappe.boot.additional_filters_config;
				for (var i$1 = 0, list$1 = Object.keys(this.filters_config); i$1 < list$1.length; i$1 += 1) {
					var key = list$1[i$1];

					var filter = this.filters_config[key];
					this.conditions.push([key, __(filter.label)]);
					for (var i = 0, list = Object.keys(this.invalid_condition_map); i < list.length; i += 1) {
						var fieldtype = list[i];

						if (!filter.valid_for_fieldtypes.includes(fieldtype)) {
							this.invalid_condition_map[fieldtype].push(key);
						}
					}
				}
			}
		}

		make() {
			this.filter_edit_area = $(
				frappe.render_template('edit_filter', {
					conditions: this.conditions,
				})
			);
			this.parent && this.filter_edit_area.appendTo(this.parent.find('.filter-edit-area'));
			this.make_select();
			this.set_events();
			this.setup();
		}

		make_select() {
			var this$1 = this;

			this.fieldselect = new frappe.ui.FieldSelect({
				parent: this.filter_edit_area.find('.fieldname-select-area'),
				doctype: this.parent_doctype,
				parent_doctype: this._parent_doctype,
				filter_fields: this.filter_fields,
				input_class: 'input-xs',
				select: function (doctype, fieldname) {
					this$1.set_field(doctype, fieldname);
				},
			});

			if (this.fieldname) {
				this.fieldselect.set_value(this.doctype, this.fieldname);
			}
		}

		set_events() {
			var this$1 = this;

			this.filter_edit_area.find('span.remove-filter').on('click', function () {
				this$1.remove();
				this$1.on_change();
			});

			this.filter_edit_area.find('.condition').change(function () {
				if (!this$1.field) { return; }

				var condition = this$1.get_condition();
				var fieldtype = null;

				if (['in', 'like', 'not in', 'not like'].includes(condition)) {
					fieldtype = 'Data';
					this$1.add_condition_help(condition);
				} else {
					this$1.filter_edit_area.find('.filter-description').empty();
				}

				if (
					['Select', 'MultiSelect'].includes(this$1.field.df.fieldtype) &&
					['in', 'not in'].includes(condition)
				) {
					fieldtype = 'MultiSelect';
				}

				this$1.set_field(
					this$1.field.df.parent,
					this$1.field.df.fieldname,
					fieldtype,
					condition
				);
			});
		}

		setup() {
			var fieldname = this.fieldname || 'name';
			// set the field
			return this.set_values(this.doctype, fieldname, this.condition, this.value);
		}

		setup_state(is_new) {
			var this$1 = this;

			var promise = Promise.resolve();
			if (is_new) {
				this.filter_edit_area.addClass('new-filter');
			} else {
				promise = this.update_filter_tag();
			}

			if (this.hidden) {
				promise.then(function () { return this$1.$filter_tag.hide(); });
			}
		}

		freeze() {
			this.update_filter_tag();
		}

		update_filter_tag() {
			var this$1 = this;

			if (this._filter_value_set) {
				return this._filter_value_set.then(function () {
					!this$1.$filter_tag ? this$1.make_tag() : this$1.set_filter_button_text();
					this$1.filter_edit_area.hide();
				});
			} else {
				return Promise.resolve();
			}
		}

		remove() {
			this.filter_edit_area.remove();
			this.field = null;
			// this.on_change(true);
		}

		set_values(doctype, fieldname, condition, value) {
			// presents given (could be via tags!)
			if (this.set_field(doctype, fieldname) === false) {
				return;
			}

			if (this.field.df.original_type === 'Check') {
				value = value == 1 ? 'Yes' : 'No';
			}
			if (condition) { this.set_condition(condition, true); }

			// set value can be asynchronous, so update_filter_tag should happen after field is set
			this._filter_value_set = Promise.resolve();

			if (['in', 'not in'].includes(condition) && Array.isArray(value)) {
				value = value.join(',');
			}

			if (Array.isArray(value)) {
				this._filter_value_set = this.field.set_value(value);
			} else if (value !== undefined || value !== null) {
				this._filter_value_set = this.field.set_value((value + '').trim());
			}
			return this._filter_value_set;
		}

		set_field(doctype, fieldname, fieldtype, condition) {
			var this$1 = this;

			// set in fieldname (again)
			var cur = {};
			if (this.field) { for (var k in this.field.df) { cur[k] = this.field.df[k]; } }

			var original_docfield = (this.fieldselect.fields_by_name[doctype] || {})[
				fieldname
			];

			if (!original_docfield) {
				console.warn(("Field " + fieldname + " is not selectable."));
				this.remove();
				return false;
			}

			var df = copy_dict(original_docfield);

			// filter field shouldn't be read only or hidden
			df.read_only = 0;
			df.hidden = 0;
			df.is_filter = true;
			delete df.hidden_due_to_dependency;

			var c = condition ? condition : this.utils.get_default_condition(df);
			this.set_condition(c);

			this.utils.set_fieldtype(df, fieldtype, this.get_condition());

			// called when condition is changed,
			// don't change if all is well
			if (
				this.field &&
				cur.fieldname == fieldname &&
				df.fieldtype == cur.fieldtype &&
				df.parent == cur.parent &&
				df.options == cur.options
			) {
				return;
			}

			// clear field area and make field
			this.fieldselect.selected_doctype = doctype;
			this.fieldselect.selected_fieldname = fieldname;

			if (
				this.filters_config &&
				this.filters_config[condition] &&
				this.filters_config[condition].valid_for_fieldtypes.includes(df.fieldtype)
			) {
				var args = {};
				if (this.filters_config[condition].depends_on) {
					var field_name = this.filters_config[condition].depends_on;
					var filter_value = this.filter_list.get_filter_value(fieldname);
					args[field_name] = filter_value;
				}
				frappe
					.xcall(this.filters_config[condition].get_field, args)
					.then(function (field) {
						df.fieldtype = field.fieldtype;
						df.options = field.options;
						df.fieldname = fieldname;
						this$1.make_field(df, cur.fieldtype);
					});
			} else {
				this.make_field(df, cur.fieldtype);
			}
		}

		make_field(df, old_fieldtype) {
			var old_text = this.field ? this.field.get_value() : null;
			this.hide_invalid_conditions(df.fieldtype, df.original_type);
			this.toggle_nested_set_conditions(df);
			var field_area = this.filter_edit_area
				.find('.filter-field')
				.empty()
				.get(0);
			df.input_class = 'input-xs';
			var f = frappe.ui.form.make_control({
				df: df,
				parent: field_area,
				only_input: true,
			});
			f.refresh();

			this.field = f;
			if (old_text && f.fieldtype === old_fieldtype) {
				this.field.set_value(old_text);
			}

			this.bind_filter_field_events();
		}

		bind_filter_field_events() {
			var this$1 = this;

			// Apply filter on input focus out
			this.field.$input.on('focusout', function () { return this$1.on_change(); });

			// run on enter
			$(this.field.wrapper)
				.find(':input')
				.keydown(function (e) {
					if (e.which == 13 && this$1.field.df.fieldtype !== 'MultiSelect') {
						this$1.on_change();
					}
				});
		}

		get_value() {
			return [
				this.fieldselect.selected_doctype,
				this.field.df.fieldname,
				this.get_condition(),
				this.get_selected_value(),
				this.hidden ];
		}

		get_selected_value() {
			return this.utils.get_selected_value(this.field, this.get_condition());
		}

		get_condition() {
			return this.filter_edit_area.find('.condition').val();
		}

		set_condition(condition, trigger_change) {
			if ( trigger_change === void 0 ) trigger_change = false;

			var $condition_field = this.filter_edit_area.find('.condition');
			$condition_field.val(condition);
			if (trigger_change) { $condition_field.change(); }
		}

		add_condition_help(condition) {
			var description = ['in', 'not in'].includes(condition)
				? __('values separated by commas')
				: __('use % as wildcard');

			this.filter_edit_area.find('.filter-description').html(description);
		}

		make_tag() {
			if (!this.field) { return; }
			this.$filter_tag = this.get_filter_tag_element().insertAfter(
				this.parent.find('.active-tag-filters .clear-filters')
			);
			this.set_filter_button_text();
			this.bind_tag();
		}

		bind_tag() {
			var this$1 = this;

			this.$filter_tag.find('.remove-filter').on('click', this.remove.bind(this));

			var filter_button = this.$filter_tag.find('.toggle-filter');
			filter_button.on('click', function () {
				filter_button
					.closest('.tag-filters-area')
					.find('.filter-edit-area')
					.show();
				this$1.filter_edit_area.toggle();
			});
		}

		set_filter_button_text() {
			this.$filter_tag.find('.toggle-filter').html(this.get_filter_button_text());
		}

		get_filter_button_text() {
			var value = this.utils.get_formatted_value(
				this.field,
				this.get_selected_value()
			);
			return ((__(this.field.df.label)) + " " + (__(this.get_condition())) + " " + (__(
				value
			)));
		}

		get_filter_tag_element() {
			return $(("<div class=\"filter-tag btn-group\">\n\t\t\t<button class=\"btn btn-default btn-xs toggle-filter\"\n\t\t\t\ttitle=\"" + (__('Edit Filter')) + "\">\n\t\t\t</button>\n\t\t\t<button class=\"btn btn-default btn-xs remove-filter\"\n\t\t\t\ttitle=\"" + (__('Remove Filter')) + "\">\n\t\t\t\t" + (frappe.utils.icon('close')) + "\n\t\t\t</button>\n\t\t</div>"));
		}

		hide_invalid_conditions(fieldtype, original_type) {
			var invalid_conditions =
				this.invalid_condition_map[original_type] ||
				this.invalid_condition_map[fieldtype] ||
				[];

			for (var i = 0, list = this.conditions; i < list.length; i += 1) {
				var condition = list[i];

				this.filter_edit_area
					.find((".condition option[value=\"" + (condition[0]) + "\"]"))
					.toggle(!invalid_conditions.includes(condition[0]));
			}
		}

		toggle_nested_set_conditions(df) {
			var this$1 = this;

			var show_condition =
				df.fieldtype === 'Link' &&
				frappe.boot.nested_set_doctypes.includes(df.options);
			this.nested_set_conditions.forEach(function (condition) {
				this$1.filter_edit_area
					.find((".condition option[value=\"" + (condition[0]) + "\"]"))
					.toggle(show_condition);
			});
		}
	};

	frappe.ui.filter_utils = {
		get_formatted_value: function get_formatted_value(field, value) {
			if (field.df.fieldname === 'docstatus') {
				value = { 0: 'Draft', 1: 'Submitted', 2: 'Cancelled' }[value] || value;
			} else if (field.df.original_type === 'Check') {
				value = { 0: 'No', 1: 'Yes' }[cint(value)];
			}
			return frappe.format(value, field.df, { only_value: 1 });
		},

		get_selected_value: function get_selected_value(field, condition) {
			if (!field) { return; }

			var val = field.get_value();

			if (typeof val === 'string') {
				val = strip(val);
			}

			if (condition == 'is' && !val) {
				val = field.df.options[0].value;
			}

			if (field.df.original_type == 'Check') {
				val = val == 'Yes' ? 1 : 0;
			}

			if (condition.indexOf('like', 'not like') !== -1) {
				// automatically append wildcards
				if (val && !(val.startsWith('%') || val.endsWith('%'))) {
					val = '%' + val + '%';
				}
			} else if (in_list(['in', 'not in'], condition)) {
				if (val) {
					val = val.split(',').map(function (v) { return strip(v); });
				}
			}
			if (val === '%') {
				val = '';
			}

			return val;
		},

		get_default_condition: function get_default_condition(df) {
			if (df.fieldtype == 'Data') {
				return 'like';
			} else if (df.fieldtype == 'Date' || df.fieldtype == 'Datetime') {
				return 'Between';
			} else {
				return '=';
			}
		},

		set_fieldtype: function set_fieldtype(df, fieldtype, condition) {
			// reset
			if (df.original_type) { df.fieldtype = df.original_type; }
			else { df.original_type = df.fieldtype; }

			df.description = '';
			df.reqd = 0;
			df.ignore_link_validation = true;

			// given
			if (fieldtype) {
				df.fieldtype = fieldtype;
				return;
			}

			// scrub
			if (df.fieldname == 'docstatus') {
				df.fieldtype = 'Select';
				df.options = [
					{ value: 0, label: __('Draft') },
					{ value: 1, label: __('Submitted') },
					{ value: 2, label: __('Cancelled') } ];
			} else if (df.fieldtype == 'Check') {
				df.fieldtype = 'Select';
				df.options = 'No\nYes';
			} else if (
				[
					'Text',
					'Small Text',
					'Text Editor',
					'Code',
					'Markdown Editor',
					'HTML Editor',
					'Tag',
					'Comments',
					'Dynamic Link',
					'Read Only',
					'Assign',
					'Color' ].indexOf(df.fieldtype) != -1
			) {
				df.fieldtype = 'Data';
			} else if (
				df.fieldtype == 'Link' &&
				[
					'=',
					'!=',
					'descendants of',
					'ancestors of',
					'not descendants of',
					'not ancestors of' ].indexOf(condition) == -1
			) {
				df.fieldtype = 'Data';
			}
			if (
				df.fieldtype === 'Data' &&
				(df.options || '').toLowerCase() === 'email'
			) {
				df.options = null;
			}
			if (
				condition == 'Between' &&
				(df.fieldtype == 'Date' || df.fieldtype == 'Datetime')
			) {
				df.fieldtype = 'DateRange';
			}
			if (
				condition == 'Timespan' &&
				['Date', 'Datetime', 'DateRange', 'Select'].includes(df.fieldtype)
			) {
				df.fieldtype = 'Select';
				df.options = this.get_timespan_options(['Last', 'Yesterday', 'Today', 'Tomorrow', 'This', 'Next']);
			}
			if (condition === 'is') {
				df.fieldtype = 'Select';
				df.options = [
					{ label: __('Set', null, 'Field value is set'), value: 'set' },
					{ label: __('Not Set', null, 'Field value is not set'), value: 'not set' } ];
			}
			return;
		},

		get_timespan_options: function get_timespan_options(periods) {
			var period_map = {
				Last: ['Week', 'Month', 'Quarter', '6 months', 'Year'],
				This: ['Week', 'Month', 'Quarter', 'Year'],
				Next: ['Week', 'Month', 'Quarter', '6 months', 'Year'],
			};
			var options = [];
			periods.forEach(function (period) {
				if (period_map[period]) {
					period_map[period].forEach(function (p) {
						options.push({
							label: (period + " " + p),
							value: ((period.toLowerCase()) + " " + (p.toLowerCase())),
						});
					});
				} else {
					options.push({
						label: __(period),
						value: ("" + (period.toLowerCase())),
					});
				}
			});
			return options;
		},
	};

	frappe.ui.FilterGroup = class {
		constructor(opts) {
			$.extend(this, opts);
			this.filters = [];
			window.fltr = this;
			if (!this.filter_button) {
				this.wrapper = this.parent;
				this.wrapper.append(this.get_filter_area_template());
				this.set_filter_events();
			} else {
				this.make_popover();
			}
		}

		make_popover() {
			this.init_filter_popover();
			this.set_popover_events();
		}

		init_filter_popover() {
			this.filter_button.popover({
				content: this.get_filter_area_template(),
				template: "\n\t\t\t\t<div class=\"filter-popover popover\">\n\t\t\t\t\t<div class=\"arrow\"></div>\n\t\t\t\t\t<div class=\"popover-body popover-content\">\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t",
				html: true,
				trigger: 'manual',
				container: 'body',
				placement: 'bottom',
				offset: '-100px, 0'
			});
		}

		toggle_empty_filters(show) {
			this.wrapper &&
				this.wrapper.find('.empty-filters').toggle(show);
		}

		set_popover_events() {
			var this$1 = this;

			$(document.body).on('click', function (e) {
				if (this$1.wrapper && this$1.wrapper.is(':visible')) {
					var in_datepicker = $(e.target).is('.datepicker--cell')
						|| $(e.target).closest('.datepicker--nav-title').length !== 0
						|| $(e.target).parents('.datepicker--nav-action').length !== 0;

					if (
						$(e.target).parents('.filter-popover').length === 0
						&& $(e.target).parents('.filter-box').length === 0
						&& this$1.filter_button.find($(e.target)).length === 0
						&& !$(e.target).is(this$1.filter_button)
						&& !in_datepicker
					) {
						this$1.wrapper && this$1.filter_button.popover('hide');
					}
				}
			});

			this.filter_button.on('click', function () {
				this$1.filter_button.popover('toggle');
			});

			this.filter_button.on('shown.bs.popover', function () {
				var hide_empty_filters = this$1.filters && this$1.filters.length > 0;

				if (!this$1.wrapper) {
					this$1.wrapper = $('.filter-popover');
					if (hide_empty_filters) {
						this$1.toggle_empty_filters(false);
						this$1.add_filters_to_popover(this$1.filters);
					}
					this$1.set_filter_events();
				}
				this$1.toggle_empty_filters(false);
				!hide_empty_filters && this$1.add_filter(this$1.doctype, 'name');
			});

			this.filter_button.on('hidden.bs.popover', function () {
				this$1.apply();
			});

			// REDESIGN-TODO: (Temporary) Review and find best solution for this
			frappe.router.on('change', function () {
				if (this$1.wrapper && this$1.wrapper.is(':visible')) {
					this$1.filter_button.popover('hide');
				}
			});
		}

		add_filters_to_popover(filters) {
			var this$1 = this;

			filters.forEach(function (filter) {
				filter.parent = this$1.wrapper;
				filter.field = null;
				filter.make();
			});
		}

		apply() {
			this.update_filters();
			this.on_change();
		}

		update_filter_button() {
			var filters_applied = this.filters.length > 0;
			var button_label = filters_applied
				? this.filters.length > 1
					? __("{0} filters", [this.filters.length])
					: __("{0} filter", [this.filters.length])
				: __('Filter');


			this.filter_button
				.toggleClass('btn-default', !filters_applied)
				.toggleClass('btn-primary-light', filters_applied);

			this.filter_button.find('.filter-icon')
				.toggleClass('active', filters_applied);

			this.filter_button.find('.button-label').html(button_label);
		}

		set_filter_events() {
			var this$1 = this;

			this.wrapper.find('.add-filter').on('click', function () {
				this$1.toggle_empty_filters(false);
				this$1.add_filter(this$1.doctype, 'name');
			});

			this.wrapper.find('.clear-filters').on('click', function () {
				this$1.toggle_empty_filters(true);
				this$1.clear_filters();
				this$1.on_change();
			});

			this.wrapper.find('.apply-filters').on('click', function () {
				this$1.filter_button.popover('hide');
			});
		}

		add_filters(filters) {
			var this$1 = this;

			var promises = [];

			var loop = function () {
				var filter = list[i];

				promises.push(function () {
					var ref;

					return (ref = this$1).add_filter.apply(ref, filter);
				});
			};

			for (var i = 0, list = filters; i < list.length; i += 1) loop();

			return frappe.run_serially(promises).then(function () { return this$1.update_filters(); });
		}

		add_filter(doctype, fieldname, condition, value, hidden) {
			if (!fieldname) { return Promise.resolve(); }
			// adds a new filter, returns true if filter has been added

			// {}: Add in page filter by fieldname if exists ('=' => 'like')

			if (!this.validate_args(doctype, fieldname)) { return false; }
			var is_new_filter = arguments.length < 2;
			if (is_new_filter && this.wrapper.find('.new-filter:visible').length) {
				// only allow 1 new filter at a time!
				return Promise.resolve();
			} else {
				var args = [doctype, fieldname, condition, value, hidden];
				var promise = this.push_new_filter(args, is_new_filter);
				return (promise && promise.then) ? promise : Promise.resolve();
			}
		}

		validate_args(doctype, fieldname) {
			if (doctype && fieldname
				&& !frappe.meta.has_field(doctype, fieldname)
				&& !frappe.model.std_fields_list.includes(fieldname)) {

				frappe.msgprint({
					message: __('Invalid filter: {0}', [fieldname.bold()]),
					indicator: 'red',
				});

				return false;
			}
			return true;
		}

		push_new_filter(args) {
			var ref;

			// args: [doctype, fieldname, condition, value]
			if (this.filter_exists(args)) { return; }

			// {}: Clear page filter fieldname field

			var filter = (ref = this)._push_new_filter.apply(ref, args);

			if (filter && filter.value) {
				// filter.setup_state(is_new_filter);
				return filter._filter_value_set; // internal promise
			}
		}

		_push_new_filter(doctype, fieldname, condition, value, hidden) {
			var this$1 = this;
			if ( hidden === void 0 ) hidden = false;

			var args = {
				parent: this.wrapper,
				parent_doctype: this.doctype,
				doctype: doctype,
				_parent_doctype: this.parent_doctype,
				fieldname: fieldname,
				condition: condition,
				value: value,
				hidden: hidden,
				index: this.filters.length + 1,
				on_change: function (update) {
					if (update) { this$1.update_filters(); }
					this$1.on_change();
				},
				filter_items: function (doctype, fieldname) {
					return !this$1.filter_exists([doctype, fieldname]);
				},
				filter_list: this.base_list || this,
			};
			var filter = new frappe.ui.Filter(args);
			this.filters.push(filter);
			return filter;
		}

		get_filter_value(fieldname) {
			var filter_obj = this.filters.find(function (f) { return f.fieldname == fieldname; }) || {};
			return filter_obj.value;
		}

		filter_exists(filter_value) {
			// filter_value of form: [doctype, fieldname, condition, value]
			var exists = false;
			this.filters
				.filter(function (f) { return f.field; })
				.map(function (f) {
					var f_value = f.get_value();
					if (filter_value.length === 2) {
						exists =
							filter_value[0] === f_value[0] && filter_value[1] === f_value[1];
						return;
					}

					var value = filter_value[3];
					var equal = frappe.utils.arrays_equal;

					if (
						equal(f_value.slice(0, 4), filter_value.slice(0, 4)) ||
						(Array.isArray(value) && equal(value, f_value[3]))
					) {
						exists = true;
					}
				});
			return exists;
		}

		get_filters() {
			return this.filters
				.filter(function (f) { return f.field; })
				.map(function (f) {
					return f.get_value();
				});
			// {}: this.list.update_standard_filters(values);
		}

		update_filters() {
			// remove hidden filters and undefined filters
			var filter_exists = function (f) { return ![undefined, null].includes(f.get_selected_value()); };
			this.filters.map(function (f) { return !filter_exists(f) && f.remove(); });
			this.filters = this.filters.filter(function (f) { return filter_exists(f) && f.field; });
			this.update_filter_button();
			this.filters.length === 0 &&
				this.toggle_empty_filters(true);
		}

		clear_filters() {
			this.filters.map(function (f) { return f.remove(true); });
			// {}: Clear page filters, .date-range-picker (called list run())
			this.filters = [];
		}

		get_filter(fieldname) {
			return this.filters.filter(function (f) {
				return f.field && f.field.df.fieldname == fieldname;
			})[0];
		}

		get_filter_area_template() {
			/* eslint-disable indent */
			return $(("\n\t\t\t<div class=\"filter-area\">\n\t\t\t\t<div class=\"filter-edit-area\">\n\t\t\t\t\t<div class=\"text-muted empty-filters text-center\">\n\t\t\t\t\t\t" + (__('No filters selected')) + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<hr class=\"divider\"></hr>\n\t\t\t\t<div class=\"filter-action-buttons\">\n\t\t\t\t\t<button class=\"text-muted add-filter btn btn-xs\">\n\t\t\t\t\t\t+ " + (__('Add a Filter')) + "\n\t\t\t\t\t</button>\n\t\t\t\t\t<div>\n\t\t\t\t\t\t<button class=\"btn btn-secondary btn-xs clear-filters\">\n\t\t\t\t\t\t\t" + (__('Clear Filters')) + "\n\t\t\t\t\t\t</button>\n\t\t\t\t\t\t" + (this.filter_button ?
								("<button class=\"btn btn-primary btn-xs apply-filters\">\n\t\t\t\t\t\t\t\t" + (__('Apply Filters')) + "\n\t\t\t\t\t\t\t</button>")
								: '') + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>")
			);
			/* eslint-disable indent */
		}

		get_filters_as_object() {
			var filters = this.get_filters().reduce(function (acc, filter) {
				var obj;

				return Object.assign(acc, ( obj = {}, obj[filter[1]] = [filter[2], filter[3]], obj ));
			}, {});
			return filters;
		}

		add_filters_to_filter_group(filters) {
			var this$1 = this;

			if (filters.length) {
				this.toggle_empty_filters(false);
				filters.forEach(function (filter) {
					this$1.add_filter(filter[0], filter[1], filter[2], filter[3]);
				});
			}
		}

		add(filters, refresh) {
			var this$1 = this;
			if ( refresh === void 0 ) refresh = true;

			if (!filters || (Array.isArray(filters) && filters.length === 0))
				{ return Promise.resolve(); }

			if (typeof filters[0] === "string") {
				// passed in the format of doctype, field, condition, value
				var filter = Array.from(arguments);
				filters = [filter];
			}

			filters = filters.filter(function (f) {
				return !this$1.exists(f);
			});

			var ref = this.set_standard_filter(
				filters
			);
			var non_standard_filters = ref.non_standard_filters;
			var promise = ref.promise;

			return promise
				.then(function () {
					return (
						non_standard_filters.length > 0 &&
						this$1.filter_list.add_filters(non_standard_filters)
					);
				})
				.then(function () {
					refresh && this$1.list_view.refresh();
				});
		}
	};

	// <select> widget with all fields of a doctype as options
	frappe.ui.FieldSelect = Class.extend({
		// opts parent, doctype, filter_fields, with_blank, select
		init: function init(opts) {
			var me = this;
			$.extend(this, opts);
			this.fields_by_name = {};
			this.options = [];
			this.$input = $('<input class="form-control">')
				.appendTo(this.parent)
				.on("click", function () { $(this).select(); });
			this.input_class && this.$input.addClass(this.input_class);
			this.select_input = this.$input.get(0);
			this.awesomplete = new Awesomplete(this.select_input, {
				minChars: 0,
				maxItems: 99,
				autoFirst: true,
				list: me.options,
				item: function item(item$1) {
					return $(repl('<li class="filter-field-select"><p>%(label)s</p></li>', item$1))
						.data("item.autocomplete", item$1)
						.get(0);
				}
			});
			this.$input.on("awesomplete-select", function(e) {
				var o = e.originalEvent;
				var value = o.text.value;
				var item = me.awesomplete.get_item(value);
				me.selected_doctype = item.doctype;
				me.selected_fieldname = item.fieldname;
				if(me.select) { me.select(item.doctype, item.fieldname); }
			});
			this.$input.on("awesomplete-selectcomplete", function(e) {
				var o = e.originalEvent;
				var value = o.text.value;
				var item = me.awesomplete.get_item(value);
				me.$input.val(item.label);
			});

			if(this.filter_fields) {
				for(var i in this.filter_fields)
					{ this.add_field_option(this.filter_fields[i]); }
			} else {
				this.build_options();
			}
			this.set_value(this.doctype, "name");
		},
		get_value: function get_value() {
			return this.selected_doctype ? this.selected_doctype + "." + this.selected_fieldname : null;
		},
		val: function val(value) {
			if(value===undefined) {
				return this.get_value();
			} else {
				this.set_value(value);
			}
		},
		clear: function clear() {
			this.selected_doctype = null;
			this.selected_fieldname = null;
			this.$input.val("");
		},
		set_value: function set_value(doctype, fieldname) {
			var me = this;
			this.clear();
			if(!doctype) { return; }

			// old style
			if(doctype.indexOf(".")!==-1) {
				var parts = doctype.split(".");
				doctype = parts[0];
				fieldname = parts[1];
			}

			$.each(this.options, function(i, v) {
				if(v.doctype===doctype && v.fieldname===fieldname) {
					me.selected_doctype = doctype;
					me.selected_fieldname = fieldname;
					me.$input.val(v.label);
					return false;
				}
			});
		},
		build_options: function build_options() {
			var me = this;
			me.table_fields = [];
			var std_filters = $.map(frappe.model.std_fields, function(d) {
				var opts = {parent: me.doctype};
				if(d.fieldname=="name") { opts.options = me.doctype; }
				return $.extend(copy_dict(d), opts);
			});

			// add parenttype column
			var doctype_obj = locals['DocType'][me.doctype];
			if(doctype_obj && cint(doctype_obj.istable)) {
				std_filters = std_filters.concat([{
					fieldname: 'parent',
					fieldtype: 'Data',
					label: 'Parent',
					parent: me.doctype,
				}]);
			}

			// blank
			if(this.with_blank) {
				this.options.push({
					label:"",
					value:"",
				});
			}

			// main table
			var main_table_fields = std_filters.concat(frappe.meta.docfield_list[me.doctype]);
			$.each(frappe.utils.sort(main_table_fields, "label", "string"), function(i, df) {
				var doctype = frappe.get_meta(me.doctype).istable && me.parent_doctype ?
					me.parent_doctype : me.doctype;

				// show fields where user has read access and if report hide flag is not set
				if (frappe.perm.has_perm(doctype, df.permlevel, "read"))
					{ me.add_field_option(df); }
			});

			// child tables
			$.each(me.table_fields, function(i, table_df) {
				if(table_df.options) {
					var child_table_fields = [].concat(frappe.meta.docfield_list[table_df.options]);

					if (table_df.fieldtype === "Table MultiSelect") {
						var link_field = frappe.meta.get_docfields(table_df.options)
							.find(function (df) { return df.fieldtype === 'Link'; });
						child_table_fields = link_field ? [link_field] : [];
					}

					$.each(frappe.utils.sort(child_table_fields, "label", "string"), function(i, df) {
						var doctype = frappe.get_meta(me.doctype).istable && me.parent_doctype ?
							me.parent_doctype : me.doctype;

						// show fields where user has read access and if report hide flag is not set
						if (frappe.perm.has_perm(doctype, df.permlevel, "read"))
							{ me.add_field_option(df); }
					});
				}
			});
		},

		add_field_option: function add_field_option(df) {
			var me = this;

			if (df.fieldname == 'docstatus' && !frappe.model.is_submittable(me.doctype))
				{ return; }

			if (frappe.model.table_fields.includes(df.fieldtype)) {
				me.table_fields.push(df);
				return;
			}

			var label = null;
			var table = null;

			if(me.doctype && df.parent==me.doctype) {
				label = __(df.label);
				table = me.doctype;
			} else {
				label = __(df.label) + ' (' + __(df.parent) + ')';
				table = df.parent;
			}

			if(frappe.model.no_value_type.indexOf(df.fieldtype) == -1 &&
				!(me.fields_by_name[df.parent] && me.fields_by_name[df.parent][df.fieldname])) {
				this.options.push({
					label: label,
					value: table + "." + df.fieldname,
					fieldname: df.fieldname,
					doctype: df.parent
				});
				if(!me.fields_by_name[df.parent]) { me.fields_by_name[df.parent] = {}; }
				me.fields_by_name[df.parent][df.fieldname] = df;
			}
		},
	});

	frappe.templates['edit_filter'] = '<div class="filter-box">  <div class="visible-xs flex justify-flex-end">   <span class="remove-filter">    {{ __("Remove") }}   </span>  </div>  <div class="list_filter row">   <div class="fieldname-select-area col-sm-4 ui-front form-group"></div>   <div class="col-sm-3 form-group">    <select class="condition form-control input-xs">     {% for condition in conditions %}     <option value="{{condition[0]}}">{{ condition[1] }}</option>     {% endfor %}    </select>   </div>   <div class="col-sm-4 form-group">    <div class="filter-field"></div>    <div class="text-muted small filter-description"></div>   </div>   <div class="col-sm-1 text-center hidden-xs">    <span class="remove-filter">     <svg class="icon icon-sm">      <use href="#icon-close" class="close"></use>     </svg>    </span>   </div>  </div> </div> ';

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt

	frappe.ui.Tags = class {
		constructor(ref) {
		var parent = ref.parent;
		var placeholder = ref.placeholder;
		var tagsList = ref.tagsList;
		var onTagAdd = ref.onTagAdd;
		var onTagRemove = ref.onTagRemove;
		var onTagClick = ref.onTagClick;
		var onChange = ref.onChange;

			this.tagsList = tagsList || [];
			this.onTagAdd = onTagAdd;
			this.onTagRemove = onTagRemove;
			this.onTagClick = onTagClick;
			this.onChange = onChange;

			this.setup(parent, placeholder);
		}

		setup(parent, placeholder) {
			this.$ul = parent;
			this.$input = $("<input class=\"tags-input form-control\"></input>");

			this.$inputWrapper = this.get_list_element(this.$input);
			this.$placeholder = this.get_list_element($(("<span class=\"tags-placeholder text-muted\">" + placeholder + "</span>")));
			this.$inputWrapper.appendTo(this.$ul);
			this.$placeholder.appendTo(this.$ul);

			this.deactivate();
			this.bind();
			this.boot();
		}

		bind() {
			var this$1 = this;

			var me = this;
			var select_tag = function() {
				var tagValue = frappe.utils.xss_sanitise(me.$input.val());
				me.addTag(tagValue);
				me.$input.val('');
			};

			this.$input.keypress(function (e) {
				if (e.which == 13 || e.keyCode == 13) { select_tag(); }
			});
			this.$input.focusout(select_tag);

			this.$input.on('blur', function () {
				this$1.deactivate();
			});

			this.$placeholder.on('click', function () {
				this$1.activate();
				this$1.$input.focus(); // focus only when clicked
			});
		}

		boot() {
			this.addTags(this.tagsList);
		}

		activate() {
			this.$placeholder.hide();
			this.$inputWrapper.show();
		}

		deactivate() {
			this.$inputWrapper.hide();
			this.$placeholder.show();
		}

		addTag(label) {
			if (label && label!== '' && !this.tagsList.includes(label)) {
				var $tag = this.get_tag(label);
				var row = this.get_list_element($tag, 'form-tag-row');
				row.insertBefore(this.$inputWrapper);
				this.tagsList.push(label);
				this.onTagAdd && this.onTagAdd(label);
			}
		}

		removeTag(label) {
			label = frappe.utils.xss_sanitise(label);
			if(this.tagsList.includes(label)) {
				this.tagsList.splice(this.tagsList.indexOf(label), 1);
				this.onTagRemove && this.onTagRemove(label);
			}
		}

		addTags(labels) {
			labels.map(this.addTag.bind(this));
		}

		clearTags() {
			this.$ul.find('.form-tag-row').remove();
			this.tagsList = [];
		}

		get_list_element($element, class_name) {
			if ( class_name === void 0 ) class_name="";

			var $li = $(("<li class=\"" + class_name + "\"></li>"));
			$element.appendTo($li);
			return $li;
		}

		get_tag(label) {
			var this$1 = this;

			var $tag = frappe.get_data_pill(label, label, function (target, pill_wrapper) {
				this$1.removeTag(target);
				pill_wrapper.closest('.form-tag-row').remove();
			});

			if (this.onTagClick) {
				$tag.on('click', '.pill-label', function () {
					this$1.onTagClick(label);
				});
			}

			return $tag;
		}
	};

	frappe.ui.TagEditor = Class.extend({
		init: function(opts) {
			/* docs:
			Arguments

			- parent
			- user_tags
			- doctype
			- docname
			*/
			$.extend(this, opts);

			this.setup_tags();

			if (!this.user_tags) {
				this.user_tags = "";
			}
			this.initialized = true;
			this.refresh(this.user_tags);
		},
		setup_tags: function() {
			var me = this;

			// hidden form, does not have parent
			if (!this.parent) {
				return;
			}

			this.wrapper = this.parent;
			if (!this.wrapper.length) { return; }

			this.tags = new frappe.ui.Tags({
				parent: this.wrapper,
				placeholder: __("Add a tag ..."),
				onTagAdd: function (tag) {
					if(me.initialized && !me.refreshing) {
						return frappe.call({
							method: "frappe.desk.doctype.tag.tag.add_tag",
							args: me.get_args(tag),
							callback: function(r) {
								var user_tags = me.user_tags ? me.user_tags.split(",") : [];
								user_tags.push(tag);
								me.user_tags = user_tags.join(",");
								me.on_change && me.on_change(me.user_tags);
								frappe.tags.utils.fetch_tags();
							}
						});
					}
				},
				onTagRemove: function (tag) {
					if(!me.refreshing) {
						return frappe.call({
							method: "frappe.desk.doctype.tag.tag.remove_tag",
							args: me.get_args(tag),
							callback: function(r) {
								var user_tags = me.user_tags.split(",");
								user_tags.splice(user_tags.indexOf(tag), 1);
								me.user_tags = user_tags.join(",");
								me.on_change && me.on_change(me.user_tags);
								frappe.tags.utils.fetch_tags();
							}
						});
					}
				}
			});
			this.setup_awesomplete();
			this.setup_complete = true;
		},
		setup_awesomplete: function() {
			var me = this;
			var $input = this.wrapper.find("input.tags-input");
			var input = $input.get(0);
			this.awesomplete = new Awesomplete(input, {
				minChars: 0,
				maxItems: 99,
				list: []
			});
			$input.on("awesomplete-open", function(e){
				$input.attr('state', 'open');
			});
			$input.on("awesomplete-close", function(e){
				$input.attr('state', 'closed');
			});
			$input.on("input", function(e) {
				var value = e.target.value;
				frappe.call({
					method: "frappe.desk.doctype.tag.tag.get_tags",
					args:{
						doctype: me.frm.doctype,
						txt: value.toLowerCase(),
					},
					callback: function(r) {
						me.awesomplete.list = r.message;
					}
				});
			});
			$input.on("focus", function(e) {
				if($input.attr('state') != 'open') {
					$input.trigger("input");
				}
			});
		},
		get_args: function(tag) {
			return {
				tag: tag,
				dt: this.frm.doctype,
				dn: this.frm.docname,
			}
		},
		refresh: function(user_tags) {
			var me = this;
			if (!this.initialized || !this.setup_complete || this.refreshing) { return; }

			me.refreshing = true;
			try {
				me.tags.clearTags();
				if(user_tags) {
					me.user_tags = user_tags;
					me.tags.addTags(user_tags.split(','));
				}
			} catch(e) {
				me.refreshing = false;
				// wtf bug
				setTimeout( function() { me.refresh(); }, 100);
			}
			me.refreshing = false;

		}
	});

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt

	frappe.ui.is_liked = function(doc) {
		var liked = frappe.ui.get_liked_by(doc);
		return liked.indexOf(frappe.session.user)===-1 ? false : true;
	};

	frappe.ui.get_liked_by = function(doc) {
		var liked = doc._liked_by;
		if(liked) {
			liked = JSON.parse(liked);
		}

		return liked || [];
	};

	frappe.ui.toggle_like = function($btn, doctype, name, callback) {
		var add = $btn.hasClass("not-liked") ? "Yes" : "No";
		// disable click
		$btn.css('pointer-events', 'none');

		frappe.call({
			method: "frappe.desk.like.toggle_like",
			quiet: true,
			args: {
				doctype: doctype,
				name: name,
				add: add,
			},
			callback: function(r) {
				// renable click
				$btn.css('pointer-events', 'auto');

				if(!r.exc) {
					// update in all local-buttons
					var action_buttons = $('.like-action[data-name="'+ name.replace(/"/g, '\"')
						+'"][data-doctype="'+ doctype.replace(/"/g, '\"')+'"]');

					if(add==="Yes") {
						action_buttons.removeClass("not-liked").addClass("liked");
					} else {
						action_buttons.addClass("not-liked").removeClass("liked");
					}

					// update in locals (form)
					var doc = locals[doctype] && locals[doctype][name];
					if(doc) {
						var liked_by = JSON.parse(doc._liked_by || "[]"),
							idx = liked_by.indexOf(frappe.session.user);
						if(add==="Yes") {
							if(idx===-1)
								{ liked_by.push(frappe.session.user); }
						} else {
							if(idx!==-1) {
								liked_by = liked_by.slice(0,idx).concat(liked_by.slice(idx+1));
							}
						}
						doc._liked_by = JSON.stringify(liked_by);
					}

					if(callback) {
						callback();
					}
				}
			}
		});
	};

	frappe.ui.click_toggle_like = function() {
		var $btn = $(this);
		var $count = $btn.siblings(".likes-count");
		var not_liked = $btn.hasClass("not-liked");
		var doctype = $btn.attr("data-doctype");
		var name = $btn.attr("data-name");

		frappe.ui.toggle_like($btn, doctype, name, function() {
			if (not_liked) {
				$count.text(cint($count.text()) + 1);
			} else {
				$count.text(cint($count.text()) - 1);
			}
		});

		return false;
	};

	frappe.ui.setup_like_popover = function ($parent, selector, check_not_liked) {
		if ( check_not_liked === void 0 ) check_not_liked=true;

		if (frappe.dom.is_touchscreen()) {
			return;
		}

		$parent.on('mouseover', selector, function() {
			var target_element = $(this);
			target_element.popover({
				animation: true,
				placement: 'bottom',
				trigger: 'manual',
				template: "<div class=\"liked-by-popover popover\">\n\t\t\t\t<div class=\"arrow\"></div>\n\t\t\t\t<div class=\"popover-body popover-content\"></div>\n\t\t\t</div>",
				content: function () {
					var liked_by = target_element.parents(".liked-by").attr('data-liked-by');
					liked_by = liked_by ? decodeURI(liked_by) : '[]';
					liked_by = JSON.parse(liked_by);

					var user = frappe.session.user;
					// hack
					if (check_not_liked) {
						if (target_element.parents(".liked-by").find(".not-liked").length) {
							if (liked_by.indexOf(user)!==-1) {
								liked_by.splice(liked_by.indexOf(user), 1);
							}
						} else {
							if (liked_by.indexOf(user)===-1) {
								liked_by.push(user);
							}
						}
					}

					if (!liked_by.length) {
						return "";
					}

					var liked_by_list = $("<ul class=\"list-unstyled\"></ul>");

					// to show social profile of the user
					var link_base = '/app/user-profile/';

					liked_by.forEach(function (user) {
						// append user list item
						liked_by_list.append(("\n\t\t\t\t\t\t<li data-user=" + user + ">" + (frappe.avatar(user, "avatar-xs")) + "\n\t\t\t\t\t\t\t<span>" + (frappe.user.full_name(user)) + "</span>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t"));
					});

					liked_by_list.children('li').click(function (ev) {
						var user = ev.currentTarget.dataset.user;
						target_element.popover('hide');
						frappe.set_route(link_base + user);
					});

					return liked_by_list;
				},
				html: true,
				container: 'body'
			});

			target_element.popover('show');

			$(".popover").on("mouseleave", function () {
				target_element.popover('hide');
			});

			target_element.on('mouseout', function () {
				setTimeout(function () {
					if (!$('.popover:hover').length) {
						target_element.popover('hide');
					}
				}, 100);
			});
		});

	};

	frappe.templates['print_template'] = '<!DOCTYPE html> <html lang="{{ lang }}" dir="{{ layout_direction }}"> <head>  <meta charset="utf-8">  <meta http-equiv="X-UA-Compatible" content="IE=edge">  <meta name="viewport" content="width=device-width, initial-scale=1">  <meta name="description" content="">  <meta name="author" content="">  <title>{{ title }}</title>  {{ frappe.assets.include_style("printview.css", base_url, frappe.utils.is_rtl(lang)) }}  <style>   {{ print_css }}  </style> </head> <body>  <div class="print-format-gutter">   {% if print_settings.repeat_header_footer %}    <div id="footer-html" class="visible-pdf">     {% if print_settings.letter_head && print_settings.letter_head.footer %}      <div class="letter-head-footer">       {{ print_settings.letter_head.footer }}      </div>     {% endif %}     <p class="text-center small page-number visible-pdf">      {{ __("Page {0} of {1}", [`<span class="page"></span>`, `<span class="topage"></span>`]) }}     </p>    </div>   {% endif %}    <div class="print-format {% if landscape %} landscape {% endif %}"     {% if columns.length > 20 %}      style="font-size: 4.0pt"     {% endif %}    >    {% if print_settings.letter_head %}    <div {% if print_settings.repeat_header_footer %} id="header-html" class="hidden-pdf" {% endif %}>     <div class="letter-head">{{ print_settings.letter_head.header }}</div>    </div>    {% endif %}    {{ content }}   </div>  </div> </body> </html> ';

	frappe.provide("frappe.views");

	frappe.views.BaseList = class BaseList {
		constructor(opts) {
			Object.assign(this, opts);
		}

		show() {
			var this$1 = this;

			frappe.run_serially([
				function () { return this$1.init(); },
				function () { return this$1.before_refresh(); },
				function () { return this$1.refresh(); } ]);
		}

		init() {
			var this$1 = this;

			if (this.init_promise) { return this.init_promise; }

			var tasks = [
				this.setup_defaults,
				this.set_stats,
				this.setup_fields,
				// make view
				this.setup_page,
				this.setup_side_bar,
				this.setup_main_section,
				this.setup_view,
				this.setup_view_menu ].map(function (fn) { return fn.bind(this$1); });

			this.init_promise = frappe.run_serially(tasks);
			return this.init_promise;
		}

		setup_defaults() {
			var this$1 = this;

			this.page_name = frappe.get_route_str();
			this.page_title = this.page_title || frappe.router.doctype_layout || __(this.doctype);
			this.meta = frappe.get_meta(this.doctype);
			this.settings = frappe.listview_settings[this.doctype] || {};
			this.user_settings = frappe.get_user_settings(this.doctype);

			this.start = 0;
			this.page_length = 20;
			this.data = [];
			this.method = "frappe.desk.reportview.get";

			this.can_create = frappe.model.can_create(this.doctype);
			this.can_write = frappe.model.can_write(this.doctype);

			this.fields = [];
			this.filters = [];
			this.sort_by = "modified";
			this.sort_order = "desc";

			// Setup buttons
			this.primary_action = null;
			this.secondary_action = null;

			this.menu_items = [
				{
					label: __("Refresh"),
					action: function () { return this$1.refresh(); },
					class: "visible-xs",
				} ];
		}

		get_list_view_settings() {
			var this$1 = this;

			return frappe
				.call("frappe.desk.listview.get_list_settings", {
					doctype: this.doctype,
				})
				.then(function (doc) { return (this$1.list_view_settings = doc.message || {}); });
		}

		setup_fields() {
			this.set_fields();
			this.build_fields();
		}

		set_fields() {
			var this$1 = this;

			var fields = [].concat(
				frappe.model.std_fields_list,
				this.meta.title_field
			);

			fields.forEach(function (f) { return this$1._add_field(f); });
		}

		get_fields_in_list_view() {
			var this$1 = this;

			return this.meta.fields.filter(function (df) {
				return (
					(frappe.model.is_value_type(df.fieldtype) &&
						(df.in_list_view &&
							frappe.perm.has_perm(
								this$1.doctype,
								df.permlevel,
								"read"
							))) ||
					(df.fieldtype === "Currency" &&
						df.options &&
						!df.options.includes(":")) ||
					df.fieldname === "status"
				);
			});
		}

		build_fields() {
			var this$1 = this;

			// fill in missing doctype
			this.fields = this.fields.map(function (f) {
				if (typeof f === "string") {
					f = [f, this$1.doctype];
				}
				return f;
			});
			// remove null or undefined values
			this.fields = this.fields.filter(Boolean);
			//de-duplicate
			this.fields = this.fields.uniqBy(function (f) { return f[0] + f[1]; });
		}

		_add_field(fieldname, doctype) {
			if (!fieldname) { return; }

			if (!doctype) { doctype = this.doctype; }

			if (typeof fieldname === "object") {
				// df is passed
				var df = fieldname;
				fieldname = df.fieldname;
				doctype = df.parent || doctype;
			}

			if (!this.fields) { this.fields = []; }
			var is_valid_field =
				frappe.model.std_fields_list.includes(fieldname) ||
				frappe.meta.has_field(doctype, fieldname) ||
				fieldname === "_seen";

			if (!is_valid_field) {
				return;
			}

			this.fields.push([fieldname, doctype]);
		}

		set_stats() {
			this.stats = ["_user_tags"];
			// add workflow field (as priority)
			this.workflow_state_fieldname = frappe.workflow.get_state_fieldname(
				this.doctype
			);
			if (this.workflow_state_fieldname) {
				if (!frappe.workflow.workflows[this.doctype]["override_status"]) {
					this._add_field(this.workflow_state_fieldname);
				}
				this.stats.push(this.workflow_state_fieldname);
			}
		}

		setup_page() {
			this.page = this.parent.page;
			this.$page = $(this.parent);
			!this.hide_card_layout && this.page.main.addClass('frappe-card');
			this.page.page_form.removeClass("row").addClass("flex");
			this.hide_page_form && this.page.page_form.hide();
			this.hide_sidebar && this.$page.addClass('no-list-sidebar');
			this.setup_page_head();
		}

		setup_page_head() {
			this.set_title();
			this.set_menu_items();
			this.set_breadcrumbs();
		}

		set_title() {
			this.page.set_title(this.page_title);
		}

		setup_view_menu() {
			// TODO: add all icons
			var icon_map = {
				'Image': 'image-view',
				'List': 'list',
				'Report': 'small-file',
				'Calendar': 'calendar',
				'Gantt': 'gantt',
				'Kanban': 'kanban',
				'Dashboard': 'dashboard',
				'Map': 'map',
			};

			if (frappe.boot.desk_settings.view_switcher) {
				/* @preserve
				for translation, don't remove
				__("List View") __("Report View") __("Dashboard View") __("Gantt View"),
				__("Kanban View") __("Calendar View") __("Image View") __("Inbox View"),
				__("Tree View") __("Map View") */
				this.views_menu = this.page.add_custom_button_group(__('{0} View', [this.view_name]),
					icon_map[this.view_name] || 'list');
				this.views_list = new frappe.views.ListViewSelect({
					doctype: this.doctype,
					parent: this.views_menu,
					page: this.page,
					list_view: this,
					sidebar: this.list_sidebar,
					icon_map: icon_map
				});
			}
		}

		set_default_secondary_action() {
			var this$1 = this;

			if (this.secondary_action) {
				var $secondary_action = this.page.set_secondary_action(
					this.secondary_action.label,
					this.secondary_action.action,
					this.secondary_action.icon
				);
				if (!this.secondary_action.icon) {
					$secondary_action.addClass("hidden-xs");
				} else if (!this.secondary_action.label) {
					$secondary_action.addClass("visible-xs");
				}
			} else {
				this.refresh_button = this.page.add_action_icon("refresh", function () {
					this$1.refresh();
				});
			}
		}

		set_menu_items() {
			var this$1 = this;

			this.set_default_secondary_action();

			this.menu_items && this.menu_items.map(function (item) {
				if (item.condition && item.condition() === false) {
					return;
				}
				var $item = this$1.page.add_menu_item(
					item.label,
					item.action,
					item.standard,
					item.shortcut
				);
				if (item.class) {
					$item[0] && $item.addClass(item.class);
				}
			});
		}

		set_breadcrumbs() {
			frappe.breadcrumbs.add(this.meta.module, this.doctype);
		}

		setup_side_bar() {
			if (this.hide_sidebar || !frappe.boot.desk_settings.list_sidebar) { return; }
			this.list_sidebar = new frappe.views.ListSidebar({
				doctype: this.doctype,
				stats: this.stats,
				parent: this.$page.find(".layout-side-section"),
				// set_filter: this.set_filter.bind(this),
				page: this.page,
				list_view: this,
			});
		}

		toggle_side_bar(show) {
			var show_sidebar = show || JSON.parse(localStorage.show_sidebar || "true");
			show_sidebar = !show_sidebar;
			localStorage.show_sidebar = show_sidebar;
			this.show_or_hide_sidebar();
			$(document.body).trigger("toggleListSidebar");
		}

		show_or_hide_sidebar() {
			var show_sidebar = JSON.parse(localStorage.show_sidebar || "true");
			$(document.body).toggleClass("no-list-sidebar", !show_sidebar);
		}

		setup_main_section() {
			var this$1 = this;

			return frappe.run_serially(
				[
					this.setup_list_wrapper,
					this.show_or_hide_sidebar,
					this.setup_filter_area,
					this.setup_sort_selector,
					this.setup_result_area,
					this.setup_no_result_area,
					this.setup_freeze_area,
					this.setup_paging_area ].map(function (fn) { return fn.bind(this$1); })
			);
		}

		setup_list_wrapper() {
			this.$frappe_list = $('<div class="frappe-list">').appendTo(
				this.page.main
			);
		}

		setup_filter_area() {
			if (this.hide_filters) { return; }
			this.filter_area = new FilterArea(this);

			if (this.filters && this.filters.length > 0) {
				return this.filter_area.set(this.filters);
			}
		}

		setup_sort_selector() {
			if (this.hide_sort_selector) { return; }
			this.sort_selector = new frappe.ui.SortSelector({
				parent: this.$filter_section,
				doctype: this.doctype,
				args: {
					sort_by: this.sort_by,
					sort_order: this.sort_order,
				},
				onchange: this.on_sort_change.bind(this),
			});
		}

		on_sort_change() {
			this.refresh();
		}

		setup_result_area() {
			this.$result = $("<div class=\"result\">");
			this.$frappe_list.append(this.$result);
		}

		setup_no_result_area() {
			this.$no_result = $(("\n\t\t\t<div class=\"no-result text-muted flex justify-center align-center\">\n\t\t\t\t" + (this.get_no_result_message()) + "\n\t\t\t</div>\n\t\t")).hide();
			this.$frappe_list.append(this.$no_result);
		}

		setup_freeze_area() {
			this.$freeze = $('<div class="freeze"></div>').hide();
			this.$frappe_list.append(this.$freeze);
		}

		get_no_result_message() {
			return __("Nothing to show");
		}

		setup_paging_area() {
			var this$1 = this;

			var paging_values = [20, 100, 500];
			this.$paging_area = $(
				("<div class=\"list-paging-area level\">\n\t\t\t\t<div class=\"level-left\">\n\t\t\t\t\t<div class=\"btn-group\">\n\t\t\t\t\t\t" + (paging_values.map(function (value) { return ("\n\t\t\t\t\t\t\t<button type=\"button\" class=\"btn btn-default btn-sm btn-paging\"\n\t\t\t\t\t\t\t\tdata-value=\"" + value + "\">\n\t\t\t\t\t\t\t\t" + value + "\n\t\t\t\t\t\t\t</button>\n\t\t\t\t\t\t"); }).join("")) + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"level-right\">\n\t\t\t\t\t<button class=\"btn btn-default btn-more btn-sm\">\n\t\t\t\t\t\t" + (__("Load More")) + "\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</div>")
			).hide();
			this.$frappe_list.append(this.$paging_area);

			// set default paging btn active
			this.$paging_area
				.find((".btn-paging[data-value=\"" + (this.page_length) + "\"]"))
				.addClass("btn-info");

			this.$paging_area.on("click", ".btn-paging, .btn-more", function (e) {
				var $this = $(e.currentTarget);

				if ($this.is(".btn-paging")) {
					// set active button
					this$1.$paging_area.find(".btn-paging").removeClass("btn-info");
					$this.addClass("btn-info");

					this$1.start = 0;
					this$1.page_length = this$1.selected_page_count = $this.data().value;
				} else if ($this.is(".btn-more")) {
					this$1.start = this$1.start + this$1.page_length;
					this$1.page_length = this$1.selected_page_count || 20;
				}
				this$1.refresh();
			});
		}

		get_fields() {
			// convert [fieldname, Doctype] => tabDoctype.fieldname
			return this.fields.map(function (f) { return frappe.model.get_full_column_name(f[0], f[1]); }
			);
		}

		get_group_by() {
			var name_field = this.fields && this.fields.find(function (f) { return f[0] == 'name'; });
			if (name_field) {
				return frappe.model.get_full_column_name(name_field[0], name_field[1]);
			}
			return null;
		}

		setup_view() {
			// for child classes
		}

		get_filter_value(fieldname) {
			var filter = this.get_filters_for_args().filter(function (f) { return f[1] == fieldname; })[0];
			if (!filter) { return; }
			return {
				'like': filter[3].replace(/^%?|%$/g, ''),
				'not set': null
			}[filter[2]] || filter[3];
		}

		get_filters_for_args() {
			// filters might have a fifth param called hidden,
			// we don't want to pass that server side
			return this.filter_area
				? this.filter_area.get().map(function (filter) { return filter.slice(0, 4); })
				: [];
		}

		get_args() {
			return {
				doctype: this.doctype,
				fields: this.get_fields(),
				filters: this.get_filters_for_args(),
				order_by: this.sort_selector && this.sort_selector.get_sql_string(),
				start: this.start,
				page_length: this.page_length,
				view: this.view,
				group_by: this.get_group_by()
			};
		}

		get_call_args() {
			var args = this.get_args();
			return {
				method: this.method,
				args: args,
				freeze: this.freeze_on_refresh || false,
				freeze_message: this.freeze_message || __("Loading") + "...",
			};
		}

		before_refresh() {
			// modify args here just before making the request
			// see list_view.js
		}

		refresh() {
			var this$1 = this;

			this.freeze(true);
			// fetch data from server
			return frappe.call(this.get_call_args()).then(function (r) {
				// render
				this$1.prepare_data(r);
				this$1.toggle_result_area();
				this$1.before_render();
				this$1.render();
				this$1.after_render();
				this$1.freeze(false);
				this$1.reset_defaults();
				if (this$1.settings.refresh) {
					this$1.settings.refresh(this$1);
				}
			});
		}

		prepare_data(r) {
			var data = r.message || {};
			data = !Array.isArray(data)
				? frappe.utils.dict(data.keys, data.values)
				: data;

			if (this.start === 0) {
				this.data = data;
			} else {
				this.data = this.data.concat(data);
			}

			this.data = this.data.uniqBy(function (d) { return d.name; });
		}

		reset_defaults() {
			this.page_length = this.page_length + this.start;
			this.start = 0;
		}

		freeze() {
			// show a freeze message while data is loading
		}

		before_render() {}

		after_render() {}

		render() {
			// for child classes
		}

		on_filter_change() {
			// fired when filters are added or removed
		}

		toggle_result_area() {
			this.$result.toggle(this.data.length > 0);
			this.$paging_area.toggle(this.data.length > 0);
			this.$no_result.toggle(this.data.length == 0);

			var show_more = this.start + this.page_length <= this.data.length;
			this.$paging_area.find(".btn-more").toggle(show_more);
		}

		call_for_selected_items(method, args) {
			var this$1 = this;
			if ( args === void 0 ) args = {};

			args.names = this.get_checked_items(true);

			frappe.call({
				method: method,
				args: args,
				freeze: true,
				callback: function (r) {
					if (!r.exc) {
						this$1.refresh();
					}
				},
			});
		}
	};

	class FilterArea {
		constructor(list_view) {
			this.list_view = list_view;
			this.list_view.page.page_form.append("<div class=\"standard-filter-section flex\"></div>");

			var filter_area = this.list_view.hide_page_form
				? this.list_view.page.custom_actions
				: this.list_view.page.page_form;

			this.list_view.$filter_section = $('<div class="filter-section flex">').appendTo(
				filter_area
			);

			this.$filter_list_wrapper = this.list_view.$filter_section;
			this.trigger_refresh = true;
			this.setup();
		}

		setup() {
			if (!this.list_view.hide_page_form) { this.make_standard_filters(); }
			this.make_filter_list();
		}

		get() {
			var filters = this.filter_list.get_filters();
			var standard_filters = this.get_standard_filters();

			return filters.concat(standard_filters).uniqBy(JSON.stringify);
		}

		set(filters) {
			var this$1 = this;

			// use to method to set filters without triggering refresh
			this.trigger_refresh = false;
			return this.add(filters, false).then(function () {
				this$1.trigger_refresh = true;
				this$1.filter_list.update_filter_button();
			});
		}

		add(filters, refresh) {
			var this$1 = this;
			if ( refresh === void 0 ) refresh = true;

			if (!filters || (Array.isArray(filters) && filters.length === 0))
				{ return Promise.resolve(); }

			if (typeof filters[0] === "string") {
				// passed in the format of doctype, field, condition, value
				var filter = Array.from(arguments);
				filters = [filter];
			}

			filters = filters.filter(function (f) {
				return !this$1.exists(f);
			});

			var ref = this.set_standard_filter(
				filters
			);
			var non_standard_filters = ref.non_standard_filters;
			var promise = ref.promise;

			return promise
				.then(function () {
					return (
						non_standard_filters.length > 0 &&
						this$1.filter_list.add_filters(non_standard_filters)
					);
				})
				.then(function () {
					refresh && this$1.list_view.refresh();
				});
		}

		refresh_list_view() {
			if (this.trigger_refresh) {
				this.list_view.start = 0;
				this.list_view.refresh();
				this.list_view.on_filter_change();
			}
		}

		exists(f) {
			var exists = false;
			// check in standard filters
			var fields_dict = this.list_view.page.fields_dict;
			if (f[2] === "=" && f[1] in fields_dict) {
				var value = fields_dict[f[1]].get_value();
				if (value) {
					exists = true;
				}
			}

			// check in filter area
			if (!exists) {
				exists = this.filter_list.filter_exists(f);
			}

			return exists;
		}

		set_standard_filter(filters) {
			if (filters.length === 0) {
				return {
					non_standard_filters: [],
					promise: Promise.resolve(),
				};
			}

			var fields_dict = this.list_view.page.fields_dict;

			var out = filters.reduce(function (out, filter) {
				// eslint-disable-next-line
				var dt = filter[0];
				var fieldname = filter[1];
				var condition = filter[2];
				var value = filter[3];
				out.promise = out.promise || Promise.resolve();
				out.non_standard_filters = out.non_standard_filters || [];

				if (
					fields_dict[fieldname] &&
					(condition === "=" || condition === "like")
				) {
					// standard filter
					out.promise = out.promise.then(function () { return fields_dict[fieldname].set_value(value); }
					);
				} else {
					// filter out non standard filters
					out.non_standard_filters.push(filter);
				}
				return out;
			}, {});

			return out;
		}

		remove_filters(filters) {
			var this$1 = this;

			filters.map(function (f) {
				this$1.remove(f[1]);
			});
		}

		remove(fieldname) {
			var fields_dict = this.list_view.page.fields_dict;

			if (fieldname in fields_dict) {
				fields_dict[fieldname].set_value("");
			}

			var filter = this.filter_list.get_filter(fieldname);
			if (filter) { filter.remove(); }
			this.filter_list.apply();
			return Promise.resolve();
		}

		clear(refresh) {
			var this$1 = this;
			if ( refresh === void 0 ) refresh = true;

			if (!refresh) {
				this.trigger_refresh = false;
			}

			this.filter_list.clear_filters();

			var promises = [];
			var fields_dict = this.list_view.page.fields_dict;
			var loop = function ( key ) {
				var field = this$1.list_view.page.fields_dict[key];
				promises.push(function () { return field.set_value(""); });
			};

			for (var key in fields_dict) loop( key );
			return frappe.run_serially(promises).then(function () {
				this$1.trigger_refresh = true;
			});
		}

		make_standard_filters() {
			var this$1 = this;

			this.standard_filters_wrapper = this.list_view.page.page_form.find('.standard-filter-section');
			var fields = [
				{
					fieldtype: "Data",
					label: "Name",
					condition: "like",
					fieldname: "name",
					onchange: function () { return this$1.refresh_list_view(); },
				} ];

			if (this.list_view.custom_filter_configs) {
				this.list_view.custom_filter_configs.forEach(function (config) {
					config.onchange = function () { return this$1.refresh_list_view(); };
				});

				fields = fields.concat(this.list_view.custom_filter_configs);
			}

			var doctype_fields = this.list_view.meta.fields;
			var title_field = this.list_view.meta.title_field;

			fields = fields.concat(
				doctype_fields
					.filter(
						function (df) { return df.fieldname === title_field ||
							(df.in_standard_filter &&
								frappe.model.is_value_type(df.fieldtype)); }
					)
					.map(function (df) {
						var options = df.options;
						var condition = "=";
						var fieldtype = df.fieldtype;
						if (
							[
								"Text",
								"Small Text",
								"Text Editor",
								"HTML Editor",
								"Data",
								"Code",
								"Read Only" ].includes(fieldtype)
						) {
							fieldtype = "Data";
							condition = "like";
						}
						if (df.fieldtype == "Select" && df.options) {
							options = df.options.split("\n");
							if (options.length > 0 && options[0] != "") {
								options.unshift("");
								options = options.join("\n");
							}
						}
						var default_value =
							fieldtype === "Link"
								? frappe.defaults.get_user_default(options)
								: null;
						if (["__default", "__global"].includes(default_value)) {
							default_value = null;
						}
						return {
							fieldtype: fieldtype,
							label: __(df.label),
							options: options,
							fieldname: df.fieldname,
							condition: condition,
							default: default_value,
							onchange: function () { return this$1.refresh_list_view(); },
							ignore_link_validation: fieldtype === "Dynamic Link",
							is_filter: 1,
						};
					})
			);

			fields.map(function (df) {
				this$1.list_view.page.add_field(df, this$1.standard_filters_wrapper);
			});
		}

		get_standard_filters() {
			var filters = [];
			var fields_dict = this.list_view.page.fields_dict;
			for (var key in fields_dict) {
				var field = fields_dict[key];
				var value = field.get_value();
				if (value) {
					if (field.df.condition === "like" && !value.includes("%")) {
						value = "%" + value + "%";
					}
					filters.push([
						this.list_view.doctype,
						field.df.fieldname,
						field.df.condition || "=",
						value ]);
				}
			}

			return filters;
		}

		make_filter_list() {
			var this$1 = this;

			$(("<div class=\"filter-selector\">\n\t\t\t<button class=\"btn btn-default btn-sm filter-button\">\n\t\t\t\t<span class=\"filter-icon\">\n\t\t\t\t\t" + (frappe.utils.icon('filter')) + "\n\t\t\t\t</span>\n\t\t\t\t<span class=\"button-label hidden-xs\">\n\t\t\t\t\t" + (__("Filter")) + "\n\t\t\t\t<span>\n\t\t\t</button>\n\t\t</div>")
			).appendTo(this.$filter_list_wrapper);

			this.filter_button = this.$filter_list_wrapper.find('.filter-button');
			this.filter_list = new frappe.ui.FilterGroup({
				base_list: this.list_view,
				parent: this.$filter_list_wrapper,
				doctype: this.list_view.doctype,
				filter_button: this.filter_button,
				default_filters: [],
				on_change: function () { return this$1.refresh_list_view(); },
			});
		}

		is_being_edited() {
			// returns true if user is currently editing filters
			return (
				this.filter_list &&
				this.filter_list.wrapper &&
				this.filter_list.wrapper.find(".filter-box:visible").length > 0
			);
		}
	}

	// utility function to validate view modes
	frappe.views.view_modes = [
		"List",
		"Report",
		"Dashboard",
		"Gantt",
		"Kanban",
		"Calendar",
		"Image",
		"Inbox",
		"Tree",
		"Map" ];
	frappe.views.is_valid = function (view_mode) { return frappe.views.view_modes.includes(view_mode); };

	class BulkOperations {
		constructor(ref) {
		var doctype = ref.doctype;

			if (!doctype) { frappe.throw(__('Doctype required')); }
			this.doctype = doctype;
		}

		print (docs) {
			var this$1 = this;

			var print_settings = frappe.model.get_doc(':Print Settings', 'Print Settings');
			var allow_print_for_draft = cint(print_settings.allow_print_for_draft);
			var is_submittable = frappe.model.is_submittable(this.doctype);
			var allow_print_for_cancelled = cint(print_settings.allow_print_for_cancelled);

			var valid_docs = docs.filter(function (doc) {
				return !is_submittable || doc.docstatus === 1 ||
					(allow_print_for_cancelled && doc.docstatus == 2) ||
					(allow_print_for_draft && doc.docstatus == 0) ||
					frappe.user.has_role('Administrator');
			}).map(function (doc) { return doc.name; });

			var invalid_docs = docs.filter(function (doc) { return !valid_docs.includes(doc.name); });

			if (invalid_docs.length > 0) {
				frappe.msgprint(__('You selected Draft or Cancelled documents'));
				return;
			}

			if (valid_docs.length === 0) {
				frappe.msgprint(__('Select atleast 1 record for printing'));
				return;
			}

			var dialog = new frappe.ui.Dialog({
				title: __('Print Documents'),
				fields: [{
					fieldtype: 'Select',
					label: __('Letter Head'),
					fieldname: 'letter_sel',
					default: __('No Letterhead'),
					options: this.get_letterhead_options()
				},
				{
					fieldtype: 'Select',
					label: __('Print Format'),
					fieldname: 'print_sel',
					options: frappe.meta.get_print_formats(this.doctype)
				},
				{
					fieldtype: 'Select',
					label: __('Page Size'),
					fieldname: 'page_size',
					options: frappe.meta.get_print_sizes(),
					default: print_settings.pdf_page_size
				},
				{
					fieldtype: 'Float',
					label: __('Page Height (in mm)'),
					fieldname: 'page_height',
					depends_on: 'eval:doc.page_size == "Custom"',
					default: print_settings.pdf_page_height
				},
				{
					fieldtype: 'Float',
					label: __('Page Width (in mm)'),
					fieldname: 'page_width',
					depends_on: 'eval:doc.page_size == "Custom"',
					default: print_settings.pdf_page_width
				}]
			});

			dialog.set_primary_action(__('Print'), function (args) {
				if (!args) { return; }
				var default_print_format = frappe.get_meta(this$1.doctype).default_print_format;
				var with_letterhead = args.letter_sel == __("No Letterhead") ? 0 : 1;
				var print_format = args.print_sel ? args.print_sel : default_print_format;
				var json_string = JSON.stringify(valid_docs);
				var letterhead = args.letter_sel;

				var pdf_options;
				if (args.page_size === "Custom") {
					if (args.page_height === 0 || args.page_width === 0) {
						frappe.throw(__('Page height and width cannot be zero'));
					}
					pdf_options = JSON.stringify({ "page-height": args.page_height, "page-width": args.page_width });
				} else {
					pdf_options = JSON.stringify({ "page-size": args.page_size });
				}

				var w = window.open(
					'/api/method/frappe.utils.print_format.download_multi_pdf?' +
					'doctype=' + encodeURIComponent(this$1.doctype) +
					'&name=' + encodeURIComponent(json_string) +
					'&format=' + encodeURIComponent(print_format) +
					'&no_letterhead=' + (with_letterhead ? '0' : '1') +
					'&letterhead=' + encodeURIComponent(letterhead) +
					'&options=' + encodeURIComponent(pdf_options)
				);

				if (!w) {
					frappe.msgprint(__('Please enable pop-ups'));
					return;
				}
			});

			dialog.show();
		}

		get_letterhead_options () {
			var letterhead_options = [__("No Letterhead")];
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: 'Letter Head',
					fields: ['name', 'is_default'],
					limit_page_length: 0
				},
				async: false,
				callback: function callback (r) {
					if (r.message) {
						r.message.forEach(function (letterhead) {
							letterhead_options.push(letterhead.name);
						});
					}
				}
			});
			return letterhead_options;
		}

		delete (docnames, done) {
			if ( done === void 0 ) done = null;

			frappe
				.call({
					method: 'frappe.desk.reportview.delete_items',
					freeze: true,
					args: {
						items: docnames,
						doctype: this.doctype
					}
				})
				.then(function (r) {
					var failed = r.message;
					if (!failed) { failed = []; }

					if (failed.length && !r._server_messages) {
						frappe.throw(__('Cannot delete {0}', [failed.map(function (f) { return f.bold(); }).join(', ')]));
					}
					if (failed.length < docnames.length) {
						frappe.utils.play_sound('delete');
						if (done) { done(); }
					}
				});
		}

		assign (docnames, done) {
			if (docnames.length > 0) {
				var assign_to = new frappe.ui.form.AssignToDialog({
					obj: this,
					method: 'frappe.desk.form.assign_to.add_multiple',
					doctype: this.doctype,
					docname: docnames,
					bulk_assign: true,
					re_assign: true,
					callback: done
				});
				assign_to.dialog.clear();
				assign_to.dialog.show();
			} else {
				frappe.msgprint(__('Select records for assignment'));
			}
		}

		apply_assignment_rule (docnames, done) {
			if (docnames.length > 0) {
				frappe.call('frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply', {
					doctype: this.doctype,
					docnames: docnames
				}).then(function () { return done(); });
			}
		}

		submit_or_cancel (docnames, action, done) {
			if ( action === void 0 ) action = 'submit';
			if ( done === void 0 ) done = null;

			action = action.toLowerCase();
			frappe
				.call({
					method: 'frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs',
					args: {
						doctype: this.doctype,
						action: action,
						docnames: docnames
					},
				})
				.then(function (r) {
					var failed = r.message;
					if (!failed) { failed = []; }

					if (failed.length && !r._server_messages) {
						frappe.throw(__('Cannot {0} {1}', [action, failed.map(function (f) { return f.bold(); }).join(', ')]));
					}
					if (failed.length < docnames.length) {
						frappe.utils.play_sound(action);
						if (done) { done(); }
					}
				});
		}

		edit (docnames, field_mappings, done) {
			var this$1 = this;

			var field_options = Object.keys(field_mappings).sort();
			var status_regex = /status/i;

			var default_field = field_options.find(function (value) { return status_regex.test(value); });

			var dialog = new frappe.ui.Dialog({
				title: __('Bulk Edit'),
				fields: [
					{
						'fieldtype': 'Select',
						'options': field_options,
						'default': default_field,
						'label': __('Field'),
						'fieldname': 'field',
						'reqd': 1,
						'onchange': function () {
							set_value_field(dialog);
						}
					},
					{
						'fieldtype': 'Data',
						'label': __('Value'),
						'fieldname': 'value',
						onchange: function onchange() {
							show_help_text();
						}
					}
				],
				primary_action: function (ref) {
					var obj;

					var value = ref.value;
					var fieldname = field_mappings[dialog.get_value('field')].fieldname;
					dialog.disable_primary_action();
					frappe.call({
						method: 'frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs',
						args: {
							doctype: this$1.doctype,
							freeze: true,
							docnames: docnames,
							action: 'update',
							data: ( obj = {}, obj[fieldname] = value || null, obj )
						}
					}).then(function (r) {
						var failed = r.message || [];

						if (failed.length && !r._server_messages) {
							dialog.enable_primary_action();
							frappe.throw(__('Cannot update {0}', [failed.map(function (f) { return f.bold ? f.bold() : f; }).join(', ')]));
						}
						done();
						dialog.hide();
						frappe.show_alert(__('Updated successfully'));
					});
				},
				primary_action_label: __('Update {0} records', [docnames.length]),
			});

			if (default_field) { set_value_field(dialog); } // to set `Value` df based on default `Field`
			show_help_text();

			function set_value_field (dialogObj) {
				var new_df = Object.assign({},
					field_mappings[dialogObj.get_value('field')]);
				/* if the field label has status in it and
				if it has select fieldtype with no default value then
				set a default value from the available option. */
				if (new_df.label.match(status_regex) &&
					new_df.fieldtype === 'Select' && !new_df.default) {
					var options = [];
					if (typeof new_df.options === "string") {
						options = new_df.options.split("\n");
					}
					//set second option as default if first option is an empty string
					new_df.default = options[0] || options[1];
				}
				new_df.label = __('Value');
				new_df.onchange = show_help_text;

				delete new_df.depends_on;
				dialogObj.replace_field('value', new_df);
				show_help_text();
			}

			function show_help_text() {
				var value = dialog.get_value('value');
				if (value == null || value === '') {
					dialog.set_df_property('value', 'description', __('You have not entered a value. The field will be set to empty.'));
				} else {
					dialog.set_df_property('value', 'description', '');
				}
			}

			dialog.refresh();
			dialog.show();
		}


		add_tags (docnames, done) {
			var this$1 = this;

			var dialog = new frappe.ui.Dialog({
				title: __('Add Tags'),
				fields: [
					{
						fieldtype: 'MultiSelectPills',
						fieldname: 'tags',
						label: __("Tags"),
						reqd: true,
						get_data: function (txt) {
							return frappe.db.get_link_options("Tag", txt);
						}
					} ],
				primary_action_label: __("Add"),
				primary_action: function () {
					var args = dialog.get_values();
					if (args && args.tags) {
						dialog.set_message("Adding Tags...");

						frappe.call({
							method: "frappe.desk.doctype.tag.tag.add_tags",
							args: {
								'tags': args.tags,
								'dt': this$1.doctype,
								'docs': docnames,
							},
							callback: function () {
								dialog.hide();
								done();
							}
						});
					}
				},
			});
			dialog.show();
		}
	}

	class ListSettings {
		constructor(ref) {
		var this$1 = this;
		var listview = ref.listview;
		var doctype = ref.doctype;
		var meta = ref.meta;
		var settings = ref.settings;

			if (!doctype) {
				frappe.throw('DocType required');
			}

			this.listview = listview;
			this.doctype = doctype;
			this.meta = meta;
			this.settings = settings;
			this.dialog = null;
			this.fields = this.settings && this.settings.fields ? JSON.parse(this.settings.fields) : [];
			this.subject_field = null;

			frappe.model.with_doctype("List View Settings", function () {
				this$1.make();
				this$1.get_listview_fields(meta);
				this$1.setup_fields();
				this$1.setup_remove_fields();
				this$1.add_new_fields();
				this$1.show_dialog();
			});
		}

		make() {
			var me = this;

			var list_view_settings = frappe.get_meta("List View Settings");

			me.dialog = new frappe.ui.Dialog({
				title: __("{0} Settings", [__(me.doctype)]),
				fields: list_view_settings.fields
			});
			me.dialog.set_values(me.settings);
			me.dialog.set_primary_action(__('Save'), function () {
				var values = me.dialog.get_values();

				frappe.show_alert({
					message: __("Saving"),
					indicator: "green"
				});

				frappe.call({
					method: "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings",
					args: {
						doctype: me.doctype,
						listview_settings: values,
						removed_listview_fields: me.removed_fields || []
					},
					callback: function (r) {
						me.listview.refresh_columns(r.message.meta, r.message.listview_settings);
						me.dialog.hide();
					}
				});
			});

			me.dialog.fields_dict["total_fields"].df.onchange = function () { return me.refresh(); };
		}

		refresh() {
			var me = this;

			me.setup_fields();
			me.add_new_fields();
			me.setup_remove_fields();
		}

		show_dialog() {
			var me = this;

			if (!this.settings.fields) {
				me.update_fields();
			}

			if (!me.dialog.get_value("total_fields")) {
				var field_count = me.fields.length;

				if (field_count < 4) {
					field_count = 4;
				} else if (field_count > 10) {
					field_count = 4;
				}

				me.dialog.set_value("total_fields", field_count);
			}

			me.dialog.show();
		}

		setup_fields() {
			function is_status_field(field) {
				return field.fieldname === "status_field";
			}

			var me = this;

			var fields_html = me.dialog.get_field("fields_html");
			var wrapper = fields_html.$wrapper[0];
			var fields = "";
			var total_fields = me.dialog.get_values().total_fields || me.settings.total_fields;

			for (var idx in me.fields) {
				if (idx == parseInt(total_fields)) {
					break;
				}
				var is_sortable = (idx == 0) ? "" : "sortable";
				var show_sortable_handle = (idx == 0) ? "hide" : "";
				var can_remove = (idx == 0 || is_status_field(me.fields[idx])) ? "hide" : "";

				fields += "\n\t\t\t\t<div class=\"control-input flex align-center form-control fields_order " + is_sortable + "\"\n\t\t\t\t\tstyle=\"display: block; margin-bottom: 5px;\" data-fieldname=\"" + (me.fields[idx].fieldname) + "\"\n\t\t\t\t\tdata-label=\"" + (me.fields[idx].label) + "\" data-type=\"" + (me.fields[idx].type) + "\">\n\n\t\t\t\t\t<div class=\"row\">\n\t\t\t\t\t\t<div class=\"col-md-1\">\n\t\t\t\t\t\t\t" + (frappe.utils.icon("drag", "xs", "", "", "sortable-handle " + show_sortable_handle)) + "\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class=\"col-md-10\" style=\"padding-left:0px;\">\n\t\t\t\t\t\t\t" + (me.fields[idx].label) + "\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class=\"col-md-1 " + can_remove + "\">\n\t\t\t\t\t\t\t<a class=\"text-muted remove-field\" data-fieldname=\"" + (me.fields[idx].fieldname) + "\">\n\t\t\t\t\t\t\t\t" + (frappe.utils.icon("delete", "xs")) + "\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>";
			}

			fields_html.html(("\n\t\t\t<div class=\"form-group\">\n\t\t\t\t<div class=\"clearfix\">\n\t\t\t\t\t<label class=\"control-label\" style=\"padding-right: 0px;\">Fields</label>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"control-input-wrapper\">\n\t\t\t\t" + fields + "\n\t\t\t\t</div>\n\t\t\t\t<p class=\"help-box small text-muted hidden-xs\">\n\t\t\t\t\t<a class=\"add-new-fields text-muted\">\n\t\t\t\t\t\t+ Add / Remove Fields\n\t\t\t\t\t</a>\n\t\t\t\t</p>\n\t\t\t</div>\n\t\t"));

			new Sortable(wrapper.getElementsByClassName("control-input-wrapper")[0], {
				handle: '.sortable-handle',
				draggable: '.sortable',
				onUpdate: function () {
					me.update_fields();
					me.refresh();
				}
			});
		}

		add_new_fields() {
			var me = this;

			var fields_html = me.dialog.get_field("fields_html");
			var add_new_fields = fields_html.$wrapper[0].getElementsByClassName("add-new-fields")[0];
			add_new_fields.onclick = function () { return me.column_selector(); };
		}

		setup_remove_fields() {
			var me = this;

			var fields_html = me.dialog.get_field("fields_html");
			var remove_fields = fields_html.$wrapper[0].getElementsByClassName("remove-field");

			var loop = function ( idx ) {
				remove_fields.item(idx).onclick = function () { return me.remove_fields(remove_fields.item(idx).getAttribute("data-fieldname")); };
			};

			for (var idx = 0; idx < remove_fields.length; idx++) loop( idx );
		}

		remove_fields(fieldname) {
			var me = this;
			var existing_fields = me.fields.map(function (f) { return f.fieldname; });

			for (var idx in me.fields) {
				var field = me.fields[idx];

				if (field.fieldname == fieldname) {
					me.fields.splice(idx, 1);
					break;
				}
			}
			me.set_removed_fields(me.get_removed_listview_fields(me.fields.map(function (f) { return f.fieldname; }), existing_fields));
			me.refresh();
			me.update_fields();
		}

		update_fields() {
			var me = this;

			var fields_html = me.dialog.get_field("fields_html");
			var wrapper = fields_html.$wrapper[0];

			var fields_order = wrapper.getElementsByClassName("fields_order");
			me.fields = [];

			for (var idx = 0; idx < fields_order.length; idx++) {
				me.fields.push({
					fieldname: fields_order.item(idx).getAttribute("data-fieldname"),
					label: fields_order.item(idx).getAttribute("data-label")
				});
			}

			me.dialog.set_value("fields", JSON.stringify(me.fields));
			me.dialog.get_value("fields");
		}

		column_selector() {
			var me = this;

			var d = new frappe.ui.Dialog({
				title: __("{0} Fields", [__(me.doctype)]),
				fields: [
					{
						label: __("Reset Fields"),
						fieldtype: "Button",
						fieldname: "reset_fields",
						click: function () { return me.reset_listview_fields(d); }
					},
					{
						label: __("Select Fields"),
						fieldtype: "MultiCheck",
						fieldname: "fields",
						options: me.get_doctype_fields(me.meta, me.fields.map(function (f) { return f.fieldname; })),
						columns: 2
					}
				]
			});
			d.set_primary_action(__('Save'), function () {
				var values = d.get_values().fields;

				me.set_removed_fields(me.get_removed_listview_fields(values, me.fields.map(function (f) { return f.fieldname; })));

				me.fields = [];
				me.set_subject_field(me.meta);
				me.set_status_field();

				for (var idx in values) {
					var value = values[idx];

					if (me.fields.length === parseInt(me.dialog.get_values().total_fields)) {
						break;
					} else if (value != me.subject_field.fieldname) {
						var field = frappe.meta.get_docfield(me.doctype, value);
						if (field) {
							me.fields.push({
								label: field.label,
								fieldname: field.fieldname
							});
						}
					}
				}

				me.refresh();
				me.dialog.set_value("fields", JSON.stringify(me.fields));
				d.hide();
			});
			d.show();
		}

		reset_listview_fields(dialog) {
			var me = this;

			frappe.xcall("frappe.desk.doctype.list_view_settings.list_view_settings.get_default_listview_fields", {
				doctype: me.doctype
			}).then(function (fields) {
				var field = dialog.get_field("fields");
				field.df.options = me.get_doctype_fields(me.meta, fields);
				dialog.refresh();
			});

		}

		get_listview_fields(meta) {
			var me = this;

			if (!me.settings.fields) {
				me.set_list_view_fields(meta);
			} else {
				me.fields = JSON.parse(this.settings.fields);
			}

			me.fields.uniqBy(function (f) { return f.fieldname; });
		}

		set_list_view_fields(meta) {
			var me = this;

			me.set_subject_field(meta);
			me.set_status_field();

			meta.fields.forEach(function (field) {
				if (field.in_list_view && !in_list(frappe.model.no_value_type, field.fieldtype) &&
					me.subject_field.fieldname != field.fieldname) {

					me.fields.push({
						label: field.label,
						fieldname: field.fieldname
					});
				}
			});
		}

		set_subject_field(meta) {
			var me = this;

			me.subject_field = {
				label: "Name",
				fieldname: "name"
			};

			if (meta.title_field) {
				var field = frappe.meta.get_docfield(me.doctype, meta.title_field.trim());

				me.subject_field = {
					label: field.label,
					fieldname: field.fieldname
				};
			}

			me.fields.push(me.subject_field);
		}

		set_status_field() {
			var me = this;

			if (frappe.has_indicator(me.doctype)) {
				me.fields.push({
					type: "Status",
					label: "Status",
					fieldname: "status_field"
				});
			}
		}

		get_doctype_fields(meta, fields) {
			var multiselect_fields = [];

			meta.fields.forEach(function (field) {
				if (!in_list(frappe.model.no_value_type, field.fieldtype)) {
					multiselect_fields.push({
						label: field.label,
						value: field.fieldname,
						checked: in_list(fields, field.fieldname)
					});
				}
			});

			return multiselect_fields;
		}

		get_removed_listview_fields(new_fields, existing_fields) {
			var me = this;
			var removed_fields = [];

			if (frappe.has_indicator(me.doctype)) {
				new_fields.push("status_field");
			}

			existing_fields.forEach(function (column) {
				if (!in_list(new_fields, column)) {
					removed_fields.push(column);
				}
			});

			return removed_fields;
		}

		set_removed_fields(fields) {
			var me = this;

			if (me.removed_fields) {
				me.removed_fields.concat(fields);
			} else {
				me.removed_fields = fields;
			}
		}
	}

	frappe.provide("frappe.views");

	frappe.views.ListView = class ListView extends frappe.views.BaseList {
		static load_last_view() {
			var route = frappe.get_route();
			var doctype = route[1];

			if (route.length === 2) {
				var user_settings = frappe.get_user_settings(doctype);
				var last_view = user_settings.last_view;
				frappe.set_route(
					"list",
					frappe.router.doctype_layout || doctype,
					frappe.views.is_valid(last_view) ? last_view.toLowerCase() : "list"
				);
				return true;
			}
			return false;
		}

		constructor(opts) {
			super(opts);
			this.show();
		}

		has_permissions() {
			var can_read = frappe.perm.has_perm(this.doctype, 0, "read");
			return can_read;
		}

		show() {
			this.parent.disable_scroll_to_top = true;

			if (!this.has_permissions()) {
				frappe.set_route('');
				frappe.msgprint(__("Not permitted to view {0}", [this.doctype]));
				return;
			}

			super.show();
		}

		get view_name() {
			return "List";
		}

		get view_user_settings() {
			return this.user_settings[this.view_name] || {};
		}

		setup_defaults() {
			var this$1 = this;

			super.setup_defaults();

			this.view = "List";
			// initialize with saved order by
			this.sort_by = this.view_user_settings.sort_by || "modified";
			this.sort_order = this.view_user_settings.sort_order || "desc";

			// set filters from user_settings or list_settings
			if (
				this.view_user_settings.filters &&
				this.view_user_settings.filters.length
			) {
				// Priority 1: user_settings
				var saved_filters = this.view_user_settings.filters;
				this.filters = this.validate_filters(saved_filters);
			} else {
				// Priority 2: filters in listview_settings
				this.filters = (this.settings.filters || []).map(function (f) {
					if (f.length === 3) {
						f = [this$1.doctype, f[0], f[1], f[2]];
					}
					return f;
				});
			}

			// build menu items
			this.menu_items = this.menu_items.concat(this.get_menu_items());

			if (
				this.view_user_settings.filters &&
				this.view_user_settings.filters.length
			) {
				// Priority 1: saved filters
				var saved_filters$1 = this.view_user_settings.filters;
				this.filters = this.validate_filters(saved_filters$1);
			} else {
				// Priority 2: filters in listview_settings
				this.filters = (this.settings.filters || []).map(function (f) {
					if (f.length === 3) {
						f = [this$1.doctype, f[0], f[1], f[2]];
					}
					return f;
				});
			}

			if (this.view_name == 'List') { this.toggle_paging = true; }

			this.patch_refresh_and_load_lib();
			return this.get_list_view_settings();
		}

		on_sort_change(sort_by, sort_order) {
			this.sort_by = sort_by;
			this.sort_order = sort_order;
			super.on_sort_change();
		}

		validate_filters(filters) {
			var valid_fields = this.meta.fields.map(function (df) { return df.fieldname; });
			valid_fields = valid_fields.concat(frappe.model.std_fields_list);
			return filters
				.filter(function (f) { return valid_fields.includes(f[1]); })
				.uniqBy(function (f) { return f[1]; });
		}

		setup_page() {
			this.parent.list_view = this;
			super.setup_page();
		}

		setup_page_head() {
			super.setup_page_head();
			this.set_primary_action();
			this.set_actions_menu_items();
		}

		set_actions_menu_items() {
			var this$1 = this;

			this.actions_menu_items = this.get_actions_menu_items();
			this.workflow_action_menu_items = this.get_workflow_action_menu_items();
			this.workflow_action_items = {};

			var actions = this.actions_menu_items.concat(
				this.workflow_action_menu_items
			);
			actions.map(function (item) {
				var $item = this$1.page.add_actions_menu_item(
					item.label,
					item.action,
					item.standard
				);
				if (item.class) {
					$item.addClass(item.class);
				}
				if (item.is_workflow_action && $item) {
					// can be used to dynamically show or hide action
					this$1.workflow_action_items[item.name] = $item;
				}
			});
		}

		show_restricted_list_indicator_if_applicable() {
			var this$1 = this;

			var match_rules_list = frappe.perm.get_match_rules(this.doctype);
			if (match_rules_list.length) {
				this.restricted_list = $(
					("<button class=\"btn btn-xs restricted-button flex align-center\">\n\t\t\t\t\t" + (frappe.utils.icon('restriction', 'xs')) + "\n\t\t\t\t</button>")
				).click(function () { return this$1.show_restrictions(match_rules_list); }).appendTo(this.page.page_form);
			}
		}

		show_restrictions(match_rules_list) {
			if ( match_rules_list === void 0 ) match_rules_list = [];

			frappe.msgprint(
				frappe.render_template("list_view_permission_restrictions", {
					condition_list: match_rules_list,
				}),
				__("Restrictions", null, "Title of message showing restrictions in list view")
			);
		}

		set_fields() {
			var this$1 = this;

			var fields = [].concat(
				frappe.model.std_fields_list,
				this.get_fields_in_list_view(),
				[this.meta.title_field, this.meta.image_field],
				this.settings.add_fields || [],
				this.meta.track_seen ? "_seen" : null,
				this.sort_by,
				"enabled",
				"disabled",
				"color"
			);

			fields.forEach(function (f) { return this$1._add_field(f); });

			this.fields.forEach(function (f) {
				var df = frappe.meta.get_docfield(f[1], f[0]);
				if (
					df &&
					df.fieldtype === "Currency" &&
					df.options &&
					!df.options.includes(":")
				) {
					this$1._add_field(df.options);
				}
			});
		}

		patch_refresh_and_load_lib() {
			var this$1 = this;

			// throttle refresh for 1s
			this.refresh = this.refresh.bind(this);
			this.refresh = frappe.utils.throttle(this.refresh, 1000);
			this.load_lib = new Promise(function (resolve) {
				if (this$1.required_libs) {
					frappe.require(this$1.required_libs, resolve);
				} else {
					resolve();
				}
			});
			// call refresh every 5 minutes
			var interval = 5 * 60 * 1000;
			setInterval(function () {
				// don't call if route is different
				if (frappe.get_route_str() === this$1.page_name) {
					this$1.refresh();
				}
			}, interval);
		}

		set_primary_action() {
			var this$1 = this;

			if (this.can_create) {
				var doctype_name = __(frappe.router.doctype_layout) || __(this.doctype);

				// Better style would be __("Add {0}", [doctype_name], "Primary action in list view")
				// Keeping it like this to not disrupt existing translations
				var label = (__("Add", null, "Primary action in list view")) + " " + doctype_name;
				this.page.set_primary_action(
					label,
					function () {
						if (this$1.settings.primary_action) {
							this$1.settings.primary_action();
						} else {
							this$1.make_new_doc();
						}
					},
					"add"
				);
			} else {
				this.page.clear_primary_action();
			}
		}

		make_new_doc() {
			var doctype = this.doctype;
			var options = {};
			this.filter_area.get().forEach(function (f) {
				if (f[2] === "=" && frappe.model.is_non_std_field(f[1])) {
					options[f[1]] = f[3];
				}
			});
			frappe.new_doc(doctype, options);
		}

		setup_view() {
			this.setup_columns();
			this.render_header();
			this.render_skeleton();
			this.setup_events();
			this.settings.onload && this.settings.onload(this);
			this.show_restricted_list_indicator_if_applicable();
		}

		refresh_columns(meta, list_view_settings) {
			this.meta = meta;
			this.list_view_settings = list_view_settings;

			this.setup_columns();
			this.refresh(true);
		}

		refresh(refresh_header) {
			var this$1 = this;
			if ( refresh_header === void 0 ) refresh_header=false;

			super.refresh().then(function () {
				this$1.render_header(refresh_header);
				this$1.update_checkbox();
			});
		}

		update_checkbox(target) {
			if (!this.$checkbox_actions) { return; }

			var $check_all_checkbox = this.$checkbox_actions.find(".list-check-all");

			if ($check_all_checkbox.prop("checked") && target && !target.prop("checked")) {
				$check_all_checkbox.prop("checked", false);
			}

			$check_all_checkbox.prop("checked", this.$checks.length === this.data.length);
		}

		setup_freeze_area() {
			this.$freeze = $(
				("<div class=\"freeze flex justify-center align-center text-muted\">\n\t\t\t\t" + (__("Loading")) + "...\n\t\t\t</div>")
			).hide();
			this.$result.append(this.$freeze);
		}

		setup_columns() {
			var this$1 = this;

			// setup columns for list view
			this.columns = [];

			var get_df = frappe.meta.get_docfield.bind(null, this.doctype);

			// 1st column: title_field or name
			if (this.meta.title_field) {
				this.columns.push({
					type: "Subject",
					df: get_df(this.meta.title_field),
				});
			} else {
				this.columns.push({
					type: "Subject",
					df: {
						label: __("Name"),
						fieldname: "name",
					},
				});
			}


			this.columns.push({
				type: "Tag"
			});

			// 2nd column: Status indicator
			if (frappe.has_indicator(this.doctype)) {
				// indicator
				this.columns.push({
					type: "Status",
				});
			}

			var fields_in_list_view = this.get_fields_in_list_view();
			// Add rest from in_list_view docfields
			this.columns = this.columns.concat(
				fields_in_list_view
					.filter(function (df) {
						if (
							frappe.has_indicator(this$1.doctype) &&
							df.fieldname === "status"
						) {
							return false;
						}
						if (!df.in_list_view) {
							return false;
						}
						return df.fieldname !== this$1.meta.title_field;
					})
					.map(function (df) { return ({
						type: "Field",
						df: df,
					}); })
			);

			if (this.list_view_settings.fields) {
				this.columns = this.reorder_listview_fields();
			}

			// limit max to 8 columns if no total_fields is set in List View Settings
			// Screen with low density no of columns 4
			// Screen with medium density no of columns 6
			// Screen with high density no of columns 8
			var total_fields = 6;

			if (window.innerWidth <= 1366) {
				total_fields = 4;
			} else if (window.innerWidth >= 1920) {
				total_fields = 8;
			}

			this.columns = this.columns.slice(0, this.list_view_settings.total_fields || total_fields);

			if (
				!this.settings.hide_name_column &&
				this.meta.title_field &&
				this.meta.title_field !== 'name'
			) {
				this.columns.push({
					type: "Field",
					df: {
						label: __("Name"),
						fieldname: "name",
					},
				});
			}
		}

		reorder_listview_fields() {
			var fields_order = [];
			var fields = JSON.parse(this.list_view_settings.fields);

			//title and tags field is fixed
			fields_order.push(this.columns[0]);
			fields_order.push(this.columns[1]);
			this.columns.splice(0, 2);

			for (var fld in fields) {
				for (var col in this.columns) {
					var field = fields[fld];
					var column = this.columns[col];

					if (column.type == "Status" && field.fieldname == "status_field") {
						fields_order.push(column);
						break;
					} else if (column.type == "Field" && field.fieldname === column.df.fieldname) {
						fields_order.push(column);
						break;
					}
				}
			}

			return fields_order;
		}

		get_documentation_link() {
			if (this.meta.documentation) {
				return ("<a href=\"" + (this.meta.documentation) + "\" target=\"blank\" class=\"meta-description small text-muted\">Need Help?</a>");
			}
			return "";
		}

		get_no_result_message() {
			var help_link = this.get_documentation_link();
			var filters = this.filter_area && this.filter_area.get();
			var no_result_message = filters && filters.length
				? __("No {0} found", [__(this.doctype)])
				: __("You haven't created a {0} yet", [__(this.doctype)]);
			var new_button_label = filters && filters.length
				? __("Create a new {0}", [__(this.doctype)], "Create a new document from list view")
				: __("Create your first {0}", [__(this.doctype)], "Create a new document from list view");
			var empty_state_image =
				this.settings.empty_state_image ||
				"/assets/frappe/images/ui-states/list-empty-state.svg";

			var new_button = this.can_create
				? ("<p><button class=\"btn btn-primary btn-sm btn-new-doc hidden-xs\">\n\t\t\t\t" + new_button_label + "\n\t\t\t</button> <button class=\"btn btn-primary btn-new-doc visible-xs\">\n\t\t\t\t" + (__("Create New", null, "Create a new document from list view")) + "\n\t\t\t</button></p>")
				: "";

			return ("<div class=\"msg-box no-border\">\n\t\t\t<div>\n\t\t\t\t<img src=\"" + empty_state_image + "\" alt=\"Generic Empty State\" class=\"null-state\">\n\t\t\t</div>\n\t\t\t<p>" + no_result_message + "</p>\n\t\t\t" + new_button + "\n\t\t\t" + help_link + "\n\t\t</div>");
		}

		freeze() {
			if (this.list_view_settings && !this.list_view_settings.disable_count) {
				this.$result
					.find(".list-count")
					.html(("<span>" + (__("Refreshing", null, "Document count in list view")) + "...</span>"));
			}
		}

		get_args() {
			var args = super.get_args();

			return Object.assign(args, {
				with_comment_count: true,
			});
		}

		before_refresh() {
			var this$1 = this;

			if (frappe.route_options && this.filter_area) {
				this.filters = this.parse_filters_from_route_options();
				frappe.route_options = null;

				if (this.filters.length > 0) {
					return this.filter_area
						.clear(false)
						.then(function () { return this$1.filter_area.set(this$1.filters); });
				}
			}

			return Promise.resolve();
		}

		parse_filters_from_settings() {
			var this$1 = this;

			return (this.settings.filters || []).map(function (f) {
				if (f.length === 3) {
					f = [this$1.doctype, f[0], f[1], f[2]];
				}
				return f;
			});
		}

		toggle_result_area() {
			super.toggle_result_area();
			this.toggle_actions_menu_button(
				this.$result.find(".list-row-check:checked").length > 0
			);
		}

		toggle_actions_menu_button(toggle) {
			if (toggle) {
				this.page.show_actions_menu();
				this.page.clear_primary_action();
				this.toggle_workflow_actions();
			} else {
				this.page.hide_actions_menu();
				this.set_primary_action();
			}
		}

		render_header(refresh_header) {
			if ( refresh_header === void 0 ) refresh_header=false;

			if (refresh_header) {
				this.$result.find('.list-row-head').remove();
			}
			if (this.$result.find(".list-row-head").length === 0) {
				// append header once
				this.$result.prepend(this.get_header_html());
			}
		}

		render_skeleton() {
			var $row = this.get_list_row_html_skeleton(
				'<div><input type="checkbox" class="render-list-checkbox"/></div>'
			);
			this.$result.append($row);
		}

		before_render() {
			this.settings.before_render && this.settings.before_render();
			frappe.model.user_settings.save(
				this.doctype,
				"last_view",
				this.view_name
			);
			this.save_view_user_settings({
				filters: this.filter_area && this.filter_area.get(),
				sort_by: this.sort_selector && this.sort_selector.sort_by,
				sort_order: this.sort_selector && this.sort_selector.sort_order,
			});
			this.toggle_paging && this.$paging_area.toggle(false);
		}

		after_render() {
			this.$no_result.html(("\n\t\t\t<div class=\"no-result text-muted flex justify-center align-center\">\n\t\t\t\t" + (this.get_no_result_message()) + "\n\t\t\t</div>\n\t\t"));
			this.setup_new_doc_event();
			this.list_sidebar && this.list_sidebar.reload_stats();
			this.toggle_paging && this.$paging_area.toggle(true);
		}

		render() {
			this.render_list();
			this.set_rows_as_checked();
			this.on_row_checked();
			this.render_count();
		}

		render_list() {
			var this$1 = this;

			// clear rows
			this.$result.find(".list-row-container").remove();
			if (this.data.length > 0) {
				// append rows
				this.$result.append(
					this.data
						.map(function (doc, i) {
							doc._idx = i;
							return this$1.get_list_row_html(doc);
						})
						.join("")
				);
			}
		}

		render_count() {
			var this$1 = this;

			if (!this.list_view_settings.disable_count) {
				this.get_count_str().then(function (str) {
					this$1.$result.find(".list-count").html(("<span>" + str + "</span>"));
				});
			}
		}

		get_header_html() {
			if (!this.columns) {
				return;
			}

			var subject_field = this.columns[0].df;
			var subject_html = "\n\t\t\t<input class=\"level-item list-check-all\" type=\"checkbox\"\n\t\t\t\ttitle=\"" + (__("Select All")) + "\">\n\t\t\t<span class=\"level-item list-liked-by-me hidden-xs\">\n\t\t\t\t<span title=\"" + (__("Likes")) + "\">" + (frappe.utils.icon('heart', 'sm', 'like-icon')) + "</span>\n\t\t\t</span>\n\t\t\t<span class=\"level-item\">" + (__(subject_field.label)) + "</span>\n\t\t";
			var $columns = this.columns
				.map(function (col) {
					var classes = [
						"list-row-col ellipsis",
						col.type == "Subject" ? "list-subject level" : "hidden-xs",
						col.type == "Tag" ? "tag-col hide": "",
						frappe.model.is_numeric_field(col.df) ? "text-right" : "" ].join(" ");

					return ("\n\t\t\t\t<div class=\"" + classes + "\">\n\t\t\t\t\t" + (col.type === "Subject" ? subject_html : ("\n\t\t\t\t\t\t<span>" + (__((col.df && col.df.label) || col.type)) + "</span>")) + "\n\t\t\t\t</div>\n\t\t\t");
				})
				.join("");

			return this.get_header_html_skeleton(
				$columns,
				'<span class="list-count"></span>'
			);
		}

		get_header_html_skeleton(left, right) {
			if ( left === void 0 ) left = "";
			if ( right === void 0 ) right = "";

			return ("\n\t\t\t<header class=\"level list-row-head text-muted\">\n\t\t\t\t<div class=\"level-left list-header-subject\">\n\t\t\t\t\t" + left + "\n\t\t\t\t</div>\n\t\t\t\t<div class=\"level-left checkbox-actions\">\n\t\t\t\t\t<div class=\"level list-subject\">\n\t\t\t\t\t\t<input class=\"level-item list-check-all\" type=\"checkbox\"\n\t\t\t\t\t\t\ttitle=\"" + (__("Select All")) + "\">\n\t\t\t\t\t\t<span class=\"level-item list-header-meta\"></span>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"level-right\">\n\t\t\t\t\t" + right + "\n\t\t\t\t</div>\n\t\t\t</header>\n\t\t");
		}

		get_left_html(doc) {
			var this$1 = this;

			return this.columns
				.map(function (col) { return this$1.get_column_html(col, doc); })
				.join("");
		}

		get_right_html(doc) {
			return this.get_meta_html(doc);
		}

		get_list_row_html(doc) {
			return this.get_list_row_html_skeleton(
				this.get_left_html(doc),
				this.get_right_html(doc)
			);
		}

		get_list_row_html_skeleton(left, right) {
			if ( left === void 0 ) left = "";
			if ( right === void 0 ) right = "";

			return ("\n\t\t\t<div class=\"list-row-container\" tabindex=\"1\">\n\t\t\t\t<div class=\"level list-row\">\n\t\t\t\t\t<div class=\"level-left ellipsis\">\n\t\t\t\t\t\t" + left + "\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"level-right text-muted ellipsis\">\n\t\t\t\t\t\t" + right + "\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t");
		}

		get_column_html(col, doc) {
			if (col.type === "Status") {
				return ("\n\t\t\t\t<div class=\"list-row-col hidden-xs ellipsis\">\n\t\t\t\t\t" + (this.get_indicator_html(doc)) + "\n\t\t\t\t</div>\n\t\t\t");
			}

			if (col.type === "Tag") {
				var tags_display_class = !this.tags_shown ? 'hide' : '';
				var tags_html = doc._user_tags ? this.get_tags_html(doc._user_tags, 2) : '<div class="tags-empty">-</div>';
				return ("\n\t\t\t\t<div class=\"list-row-col tag-col " + tags_display_class + " hidden-xs ellipsis\">\n\t\t\t\t\t" + tags_html + "\n\t\t\t\t</div>\n\t\t\t");
			}

			var df = col.df || {};
			var label = df.label;
			var fieldname = df.fieldname;
			var value = doc[fieldname] || "";

			var format = function () {
				if (df.fieldtype === "Code") {
					return value;
				} else if (df.fieldtype === "Percent") {
					return ("<div class=\"progress\" style=\"margin: 0px;\">\n\t\t\t\t\t\t<div class=\"progress-bar progress-bar-success\" role=\"progressbar\"\n\t\t\t\t\t\t\taria-valuenow=\"" + value + "\"\n\t\t\t\t\t\t\taria-valuemin=\"0\" aria-valuemax=\"100\" style=\"width: " + (Math.round(value)) + "%;\">\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>");
				} else {
					return frappe.format(value, df, null, doc);
				}
			};

			var field_html = function () {
				var html;
				var _value;
				var strip_html_required =
					df.fieldtype == "Text Editor" ||
					(df.fetch_from &&
						["Text", "Small Text"].includes(df.fieldtype));

				if (strip_html_required) {
					_value = strip_html(value);
				} else {
					_value =
						typeof value === "string"
							? frappe.utils.escape_html(value)
							: value;
				}

				if (df.fieldtype === "Image") {
					html = df.options ? ("<img src=\"" + (doc[df.options]) + "\"\n\t\t\t\t\tstyle=\"max-height: 30px; max-width: 100%;\">")
						: ("<div class=\"missing-image small\">\n\t\t\t\t\t\t" + (frappe.utils.icon('restriction')) + "\n\t\t\t\t\t</div>");
				} else if (df.fieldtype === "Select") {
					html = "<span class=\"filterable indicator-pill " + (frappe.utils.guess_colour(
						_value
					)) + " ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + value + "\">\n\t\t\t\t\t<span class=\"ellipsis\"> " + (__(_value)) + " </span>\n\t\t\t\t</span>";
				} else if (df.fieldtype === "Link") {
					html = "<a class=\"filterable ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + value + "\">\n\t\t\t\t\t" + _value + "\n\t\t\t\t</a>";
				} else if (
					["Text Editor", "Text", "Small Text", "HTML Editor", "Markdown Editor"].includes(
						df.fieldtype
					)
				) {
					html = "<span class=\"ellipsis\">\n\t\t\t\t\t" + _value + "\n\t\t\t\t</span>";
				} else {
					html = "<a class=\"filterable ellipsis\"\n\t\t\t\t\tdata-filter=\"" + fieldname + ",=," + (frappe.utils.escape_html(value)) + "\">\n\t\t\t\t\t" + (format()) + "\n\t\t\t\t</a>";
				}

				return ("<span class=\"ellipsis\"\n\t\t\t\ttitle=\"" + (__(label)) + ": " + (frappe.utils.escape_html(_value)) + "\">\n\t\t\t\t" + html + "\n\t\t\t</span>");
			};

			var class_map = {
				Subject: "list-subject level",
				Field: "hidden-xs",
			};
			var css_class = [
				"list-row-col ellipsis",
				class_map[col.type],
				frappe.model.is_numeric_field(df) ? "text-right" : "" ].join(" ");

			var html_map = {
				Subject: this.get_subject_html(doc),
				Field: field_html(),
			};
			var column_html = html_map[col.type];

			// listview_setting formatter
			if (
				this.settings.formatters &&
				this.settings.formatters[fieldname]
			) {
				column_html = this.settings.formatters[fieldname](value, df, doc);
			}

			return ("\n\t\t\t<div class=\"" + css_class + "\">\n\t\t\t\t" + column_html + "\n\t\t\t</div>\n\t\t");
		}

		get_tags_html(user_tags, limit, colored) {
			if ( colored === void 0 ) colored=false;

			var get_tag_html = function (tag) {
				var color = '', style = '';
				if (tag) {
					if (colored) {
						color = frappe.get_palette(tag);
						style = "background-color: var(" + (color[0]) + "); color: var(" + (color[1]) + ")";
					}

					return ("<div class=\"tag-pill ellipsis\" title=\"" + tag + "\" style=\"" + style + "\">" + tag + "</div>");
				}
			};
			return user_tags.split(',').slice(1, limit + 1).map(get_tag_html).join('');
		}

		get_meta_html(doc) {
			var html = "";

			var settings_button = null;
			if (this.settings.button && this.settings.button.show(doc)) {
				settings_button = "\n\t\t\t\t<span class=\"list-actions\">\n\t\t\t\t\t<button class=\"btn btn-action btn-default btn-xs\"\n\t\t\t\t\t\tdata-name=\"" + (doc.name) + "\" data-idx=\"" + (doc._idx) + "\"\n\t\t\t\t\t\ttitle=\"" + (this.settings.button.get_description(doc)) + "\">\n\t\t\t\t\t\t" + (this.settings.button.get_label(doc)) + "\n\t\t\t\t\t</button>\n\t\t\t\t</span>\n\t\t\t";
			}

			var modified = comment_when(doc.modified, true);

			var assigned_to = "<div class=\"list-assignments\">\n\t\t\t<span class=\"avatar avatar-small\">\n\t\t\t<span class=\"avatar-empty\"></span>\n\t\t</div>";

			var assigned_users = JSON.parse(doc._assign || "[]");
			if (assigned_users.length) {
				assigned_to = "<div class=\"list-assignments\">\n\t\t\t\t\t" + (frappe.avatar_group(assigned_users, 3, { filterable: true })[0].outerHTML) + "\n\t\t\t\t</div>";
			}

			var comment_count = "<span class=\"" + (!doc._comment_count ? "text-extra-muted" : "") + " comment-count\">\n\t\t\t\t" + (frappe.utils.icon('small-message')) + "\n\t\t\t\t" + (doc._comment_count > 99 ? "99+" : doc._comment_count) + "\n\t\t\t</span>";

			html += "\n\t\t\t<div class=\"level-item list-row-activity hidden-xs\">\n\t\t\t\t<div class=\"hidden-md hidden-xs\">\n\t\t\t\t\t" + (settings_button || assigned_to) + "\n\t\t\t\t</div>\n\t\t\t\t" + modified + "\n\t\t\t\t" + comment_count + "\n\t\t\t</div>\n\t\t\t<div class=\"level-item visible-xs text-right\">\n\t\t\t\t" + (this.get_indicator_dot(doc)) + "\n\t\t\t</div>\n\t\t";

			return html;
		}

		get_count_str() {
			var this$1 = this;

			var current_count = this.data.length;
			var count_without_children = this.data.uniqBy(function (d) { return d.name; }).length;

			return frappe.db.count(this.doctype, {
				filters: this.get_filters_for_args()
			}).then(function (total_count) {
				this$1.total_count = total_count || current_count;
				this$1.count_without_children = count_without_children !== current_count ? count_without_children : undefined;
				var str = __('{0} of {1}', [current_count, this$1.total_count]);
				if (this$1.count_without_children) {
					str = __('{0} of {1} ({2} rows with children)', [count_without_children, this$1.total_count, current_count]);
				}
				return str;
			});
		}

		get_form_link(doc) {
			if (this.settings.get_form_link) {
				return this.settings.get_form_link(doc);
			}

			return ("/app/" + (frappe.router.slug(frappe.router.doctype_layout || this.doctype)) + "/" + (encodeURIComponent(doc.name)));
		}

		get_seen_class(doc) {
			return JSON.parse(doc._seen || '[]').includes(frappe.session.user)
				? ''
				: 'bold';
		}

		get_like_html(doc) {
			var liked_by = JSON.parse(doc._liked_by || "[]");
			var heart_class = liked_by.includes(frappe.session.user)
				? "liked-by liked"
				: "not-liked";

			return ("<span\n\t\t\tclass=\"like-action " + heart_class + "\"\n\t\t\tdata-name=\"" + (doc.name) + "\" data-doctype=\"" + (this.doctype) + "\"\n\t\t\tdata-liked-by=\"" + (encodeURI(doc._liked_by) || "[]") + "\"\n\t\t\ttitle=\"" + (liked_by.map(function (u) { return frappe.user_info(u).fullname; }).join(', ')) + "\">\n\t\t\t" + (frappe.utils.icon('heart', 'sm', 'like-icon')) + "\n\t\t</span>\n\t\t<span class=\"likes-count\">\n\t\t\t" + (liked_by.length > 99 ? __("99") + "+" : __(liked_by.length || "")) + "\n\t\t</span>");
		}

		get_subject_html(doc) {
			var subject_field = this.columns[0].df;
			var value = doc[subject_field.fieldname];
			if (this.settings.formatters && this.settings.formatters[subject_field.fieldname]) {
				var formatter = this.settings.formatters[subject_field.fieldname];
				value = formatter(value, subject_field, doc);
			}
			if (!value) {
				value = doc.name;
			}
			var subject = strip_html(value.toString());
			var escaped_subject = frappe.utils.escape_html(subject);

			var seen = this.get_seen_class(doc);

			var subject_html = "\n\t\t\t<span class=\"level-item select-like\">\n\t\t\t\t<input class=\"list-row-checkbox\" type=\"checkbox\"\n\t\t\t\t\tdata-name=\"" + (escape(doc.name)) + "\">\n\t\t\t\t<span class=\"list-row-like hidden-xs style=\"margin-bottom: 1px;\">\n\t\t\t\t\t" + (this.get_like_html(doc)) + "\n\t\t\t\t</span>\n\t\t\t</span>\n\t\t\t<span class=\"level-item " + seen + " ellipsis\" title=\"" + escaped_subject + "\">\n\t\t\t\t<a class=\"ellipsis\"\n\t\t\t\t\thref=\"" + (this.get_form_link(doc)) + "\"\n\t\t\t\t\ttitle=\"" + escaped_subject + "\"\n\t\t\t\t\tdata-doctype=\"" + (this.doctype) + "\"\n\t\t\t\t\tdata-name=\"" + (doc.name) + "\">\n\t\t\t\t\t" + subject + "\n\t\t\t\t</a>\n\t\t\t</span>\n\t\t";

			return subject_html;
		}

		get_indicator_html(doc) {
			var indicator = frappe.get_indicator(doc, this.doctype);
			if (indicator) {
				return ("<span class=\"indicator-pill " + (indicator[1]) + " filterable ellipsis\"\n\t\t\t\tdata-filter='" + (indicator[2]) + "'>\n\t\t\t\t<span class=\"ellipsis\"> " + (__(indicator[0])) + "</span>\n\t\t\t<span>");
			}
			return "";
		}

		get_indicator_dot(doc) {
			var indicator = frappe.get_indicator(doc, this.doctype);
			if (!indicator) { return ""; }
			return ("<span class='indicator " + (indicator[1]) + "' title='" + (__(
				indicator[0]
			)) + "'></span>");
		}

		get_image_url(doc) {
			var url = doc.image ? doc.image : doc[this.meta.image_field];
			// absolute url for mobile
			if (window.cordova && !frappe.utils.is_url(url)) {
				url = frappe.base_url + url;
			}
			return url || null;
		}

		setup_events() {
			this.setup_filterable();
			this.setup_list_click();
			this.setup_tag_event();
			this.setup_new_doc_event();
			this.setup_check_events();
			this.setup_like();
			this.setup_realtime_updates();
			this.setup_action_handler();
			this.setup_keyboard_navigation();
		}

		setup_keyboard_navigation() {
			var this$1 = this;

			var focus_first_row = function () {
				this$1.$result.find(".list-row-container:first").focus();
			};
			var focus_next = function () {
				$(document.activeElement)
					.next()
					.focus();
			};
			var focus_prev = function () {
				$(document.activeElement)
					.prev()
					.focus();
			};
			var list_row_focused = function () {
				return $(document.activeElement).is(".list-row-container");
			};
			var check_row = function ($row) {
				var $input = $row.find("input[type=checkbox]");
				$input.click();
			};
			var get_list_row_if_focused = function () { return list_row_focused() ? $(document.activeElement) : null; };

			var is_current_page = function () { return this$1.page.wrapper.is(":visible"); };
			var is_input_focused = function () { return $(document.activeElement).is("input"); };

			var handle_navigation = function (direction) {
				if (!is_current_page() || is_input_focused()) { return false; }

				var $list_row = get_list_row_if_focused();
				if ($list_row) {
					direction === "down" ? focus_next() : focus_prev();
				} else {
					focus_first_row();
				}
			};

			frappe.ui.keys.add_shortcut({
				shortcut: "down",
				action: function () { return handle_navigation("down"); },
				description: __("Navigate list down", null, "Description of a list view shortcut"),
				page: this.page,
			});

			frappe.ui.keys.add_shortcut({
				shortcut: "up",
				action: function () { return handle_navigation("up"); },
				description: __("Navigate list up", null, "Description of a list view shortcut"),
				page: this.page,
			});

			frappe.ui.keys.add_shortcut({
				shortcut: "shift+down",
				action: function () {
					if (!is_current_page() || is_input_focused()) { return false; }
					var $list_row = get_list_row_if_focused();
					check_row($list_row);
					focus_next();
				},
				description: __("Select multiple list items", null, "Description of a list view shortcut"),
				page: this.page,
			});

			frappe.ui.keys.add_shortcut({
				shortcut: "shift+up",
				action: function () {
					if (!is_current_page() || is_input_focused()) { return false; }
					var $list_row = get_list_row_if_focused();
					check_row($list_row);
					focus_prev();
				},
				description: __("Select multiple list items", null, "Description of a list view shortcut"),
				page: this.page,
			});

			frappe.ui.keys.add_shortcut({
				shortcut: "enter",
				action: function () {
					var $list_row = get_list_row_if_focused();
					if ($list_row) {
						$list_row.find("a[data-name]")[0].click();
						return true;
					}
					return false;
				},
				description: __("Open list item", null, "Description of a list view shortcut"),
				page: this.page,
			});

			frappe.ui.keys.add_shortcut({
				shortcut: "space",
				action: function () {
					var $list_row = get_list_row_if_focused();
					if ($list_row) {
						check_row($list_row);
						return true;
					}
					return false;
				},
				description: __("Select list item", null, "Description of a list view shortcut"),
				page: this.page,
			});
		}

		setup_filterable() {
			var this$1 = this;

			// filterable events
			this.$result.on("click", ".filterable", function (e) {
				if (e.metaKey || e.ctrlKey) { return; }
				e.stopPropagation();
				var $this = $(e.currentTarget);
				var filters = $this.attr("data-filter").split("|");
				var filters_to_apply = filters.map(function (f) {
					f = f.split(",");
					if (f[2] === "Today") {
						f[2] = frappe.datetime.get_today();
					} else if (f[2] == "User") {
						f[2] = frappe.session.user;
					}
					this$1.filter_area.remove(f[0]);
					return [this$1.doctype, f[0], f[1], f.slice(2).join(",")];
				});
				this$1.filter_area.add(filters_to_apply);
			});
		}

		setup_list_click() {
			var this$1 = this;

			this.$result.on("click", ".list-row, .image-view-header, .file-header", function (e) {
				var $target = $(e.target);
				// tick checkbox if Ctrl/Meta key is pressed
				if (e.ctrlKey || (e.metaKey && !$target.is("a"))) {
					var $list_row = $(e.currentTarget);
					var $check = $list_row.find(".list-row-checkbox");
					$check.prop("checked", !$check.prop("checked"));
					e.preventDefault();
					this$1.on_row_checked();
					return;
				}
				// don't open form when checkbox, like, filterable are clicked
				if (
					$target.hasClass("filterable") ||
					$target.hasClass("select-like") ||
					$target.hasClass("file-select") ||
					$target.hasClass("list-row-like") ||
					$target.is(":checkbox")
				) {
					e.stopPropagation();
					return;
				}

				// link, let the event be handled via set_route
				if ($target.is("a")) { return; }

				// clicked on the row, open form
				var $row = $(e.currentTarget);
				var link = $row.find(".list-subject a").get(0);
				if (link) {
					frappe.set_route(link.pathname);
					return false;
				}
			});
		}

		setup_action_handler() {
			var this$1 = this;

			this.$result.on("click", ".btn-action", function (e) {
				var $button = $(e.currentTarget);
				var doc = this$1.data[$button.attr("data-idx")];
				this$1.settings.button.action(doc);
				e.stopPropagation();
				return false;
			});
		}

		setup_check_events() {
			var this$1 = this;

			this.$result.on("change", "input[type=checkbox]", function (e) {
				var $target = $(e.currentTarget);

				if ($target.is(".list-header-subject .list-check-all")) {
					var $check = this$1.$result.find(
						".checkbox-actions .list-check-all"
					);
					$check.prop("checked", $target.prop("checked"));
					$check.trigger("change");
				} else if ($target.is(".checkbox-actions .list-check-all")) {
					var $check$1 = this$1.$result.find(
						".list-header-subject .list-check-all"
					);
					$check$1.prop("checked", $target.prop("checked"));

					this$1.$result
						.find(".list-row-checkbox")
						.prop("checked", $target.prop("checked"));
				} else if ($target.attr('data-parent')) {
					this$1.$result
						.find(("." + ($target.attr('data-parent'))))
						.find('.list-row-checkbox')
						.prop("checked", $target.prop("checked"));
				}

				this$1.on_row_checked();
			});

			this.$result.on("click", ".list-row-checkbox", function (e) {
				var assign;

				var $target = $(e.currentTarget);

				// shift select checkboxes
				if (
					e.shiftKey &&
					this$1.$checkbox_cursor &&
					!$target.is(this$1.$checkbox_cursor)
				) {
					var name_1 = this$1.$checkbox_cursor.data().name;
					var name_2 = $target.data().name;
					var index_1 = this$1.data.findIndex(function (d) { return d.name === name_1; });
					var index_2 = this$1.data.findIndex(function (d) { return d.name === name_2; });
					var ref = [index_1, index_2];
					var min_index = ref[0];
					var max_index = ref[1];

					if (min_index > max_index) {
						(assign = [max_index, min_index], min_index = assign[0], max_index = assign[1]);
					}

					var docnames = this$1.data
						.slice(min_index + 1, max_index)
						.map(function (d) { return d.name; });
					var selector = docnames
						.map(function (name) { return (".list-row-checkbox[data-name=\"" + name + "\"]"); })
						.join(",");
					this$1.$result.find(selector).prop("checked", true);
				}

				this$1.$checkbox_cursor = $target;

				this$1.update_checkbox($target);
			});
		}

		setup_like() {
			var this$1 = this;

			this.$result.on("click", ".like-action", frappe.ui.click_toggle_like);
			this.$result.on("click", ".list-liked-by-me", function (e) {
				var $this = $(e.currentTarget);
				$this.toggleClass("active");

				if ($this.hasClass("active")) {
					this$1.filter_area.add(
						this$1.doctype,
						"_liked_by",
						"like",
						"%" + frappe.session.user + "%"
					);
				} else {
					this$1.filter_area.remove("_liked_by");
				}
			});

		}

		setup_new_doc_event() {
			var this$1 = this;

			this.$no_result.find(".btn-new-doc").click(function () {
				if (this$1.settings.primary_action) {
					this$1.settings.primary_action();
				} else {
					this$1.make_new_doc();
				}
			});
		}

		setup_tag_event() {
			var this$1 = this;

			this.tags_shown = false;
			this.list_sidebar && this.list_sidebar.parent.on("click", ".list-tag-preview", function () {
				this$1.tags_shown = !this$1.tags_shown;
				this$1.toggle_tags();
			});
		}

		setup_realtime_updates() {
			var this$1 = this;

			if (
				this.list_view_settings &&
				this.list_view_settings.disable_auto_refresh
			) {
				return;
			}
			frappe.realtime.on("list_update", function (data) {
				if (this$1.filter_area.is_being_edited()) {
					return;
				}

				var doctype = data.doctype;
				var name = data.name;
				if (doctype !== this$1.doctype) { return; }

				// filters to get only the doc with this name
				var call_args = this$1.get_call_args();
				call_args.args.filters.push([this$1.doctype, "name", "=", name]);
				call_args.args.start = 0;

				frappe.call(call_args).then(function (ref) {
					var message = ref.message;

					if (!message) { return; }
					var data = frappe.utils.dict(message.keys, message.values);
					if (!(data && data.length)) {
						// this doc was changed and should not be visible
						// in the listview according to filters applied
						// let's remove it manually
						this$1.data = this$1.data.filter(function (d) { return d.name !== name; });
						this$1.render_list();
						return;
					}

					var datum = data[0];
					var index = this$1.data.findIndex(function (d) { return d.name === datum.name; });

					if (index === -1) {
						// append new data
						this$1.data.push(datum);
					} else {
						// update this data in place
						this$1.data[index] = datum;
					}

					this$1.data.sort(function (a, b) {
						var a_value = a[this$1.sort_by] || "";
						var b_value = b[this$1.sort_by] || "";

						var return_value = 0;
						if (a_value > b_value) {
							return_value = 1;
						}

						if (b_value > a_value) {
							return_value = -1;
						}

						if (this$1.sort_order === "desc") {
							return_value = -return_value;
						}
						return return_value;
					});
					this$1.toggle_result_area();
					this$1.render_list();
					if (this$1.$checks && this$1.$checks.length) {
						this$1.set_rows_as_checked();
					}
				});
			});
		}

		set_rows_as_checked() {
			var this$1 = this;

			$.each(this.$checks, function (i, el) {
				var docname = $(el).attr("data-name");
				this$1.$result
					.find((".list-row-checkbox[data-name='" + docname + "']"))
					.prop("checked", true);
			});
			this.on_row_checked();
		}

		on_row_checked() {
			this.$list_head_subject =
				this.$list_head_subject ||
				this.$result.find("header .list-header-subject");
			this.$checkbox_actions =
				this.$checkbox_actions ||
				this.$result.find("header .checkbox-actions");

			this.$checks = this.$result.find(".list-row-checkbox:checked");

			this.$list_head_subject.toggle(this.$checks.length === 0);
			this.$checkbox_actions.toggle(this.$checks.length > 0);

			if (this.$checks.length === 0) {
				this.$list_head_subject
					.find(".list-check-all")
					.prop("checked", false);
			} else {
				this.$checkbox_actions
					.find(".list-header-meta")
					.html(__("{0} items selected", [this.$checks.length]));
				this.$checkbox_actions.show();
				this.$list_head_subject.hide();
			}
			this.update_checkbox();
			this.toggle_actions_menu_button(this.$checks.length > 0);
		}

		toggle_tags() {
			this.$result.find('.tag-col').toggleClass("hide");
			var preview_label = this.tags_shown ? __("Hide Tags") : __("Show Tags");
			this.list_sidebar.parent.find(".list-tag-preview").text(preview_label);
		}

		get_checked_items(only_docnames) {
			var docnames = Array.from(this.$checks || []).map(function (check) { return cstr(unescape($(check).data().name)); }
			);

			if (only_docnames) { return docnames; }

			return this.data.filter(function (d) { return docnames.includes(d.name); });
		}

		save_view_user_settings(obj) {
			return frappe.model.user_settings.save(
				this.doctype,
				this.view_name,
				obj
			);
		}

		on_update() {}

		get_share_url() {
			var query_params = this.get_filters_for_args()
				.map(function (filter) {
					filter[3] = encodeURIComponent(filter[3]);
					if (filter[2] === "=") {
						return ((filter[1]) + "=" + (filter[3]));
					}
					return [
						filter[1],
						"=",
						encodeURIComponent(JSON.stringify([filter[2], filter[3]])) ].join("");
				})
				.join("&");

			var full_url = window.location.href;
			if (query_params) {
				full_url += "?" + query_params;
			}
			return full_url;
		}

		share_url() {
			var this$1 = this;

			var d = new frappe.ui.Dialog({
				title: __("Share URL"),
				fields: [
					{
						fieldtype: "Code",
						fieldname: "url",
						label: "URL",
						default: this.get_share_url(),
						read_only: 1,
					} ],
				primary_action_label: __("Copy to clipboard"),
				primary_action: function () {
					frappe.utils.copy_to_clipboard(this$1.get_share_url());
					d.hide();
				},
			});
			d.show();
		}

		get_menu_items() {
			var this$1 = this;

			var doctype = this.doctype;
			var items = [];

			if (frappe.model.can_import(doctype)) {
				items.push({
					label: __("Import", null, "Button in list view menu"),
					action: function () { return frappe.set_route("list", "data-import", {
							reference_doctype: doctype,
						}); },
					standard: true,
				});
			}

			if (frappe.model.can_set_user_permissions(doctype)) {
				items.push({
					label: __("User Permissions", null, "Button in list view menu"),
					action: function () { return frappe.set_route("list", "user-permission", {
							allow: doctype,
						}); },
					standard: true,
				});
			}

			if (frappe.user_roles.includes("System Manager")) {
				items.push({
					label: __("Role Permissions Manager", null, "Button in list view menu"),
					action: function () { return frappe.set_route("permission-manager", {
							doctype: doctype,
						}); },
					standard: true,
				});

				items.push({
					label: __("Customize", null, "Button in list view menu"),
					action: function () {
						if (!this$1.meta) { return; }
						if (this$1.meta.custom) {
							frappe.set_route("form", "doctype", doctype);
						} else if (!this$1.meta.custom) {
							frappe.set_route("form", "customize-form", {
								doc_type: doctype,
							});
						}
					},
					standard: true,
					shortcut: "Ctrl+J",
				});
			}

			items.push({
				label: __("Toggle Sidebar", null, "Button in list view menu"),
				action: function () { return this$1.toggle_side_bar(); },
				condition: function () { return !this$1.hide_sidebar; },
				standard: true,
				shortcut: "Ctrl+K",
			});

			items.push({
				label: __("Share URL", null, "Button in list view menu"),
				action: function () { return this$1.share_url(); },
				standard: true,
				shortcut: "Ctrl+L",
			});

			if (
				frappe.user.has_role("System Manager") &&
				frappe.boot.developer_mode === 1
			) {
				// edit doctype
				items.push({
					label: __("Edit DocType", null, "Button in list view menu"),
					action: function () { return frappe.set_route("form", "doctype", doctype); },
					standard: true,
				});
			}

			if (frappe.user.has_role("System Manager")) {
				if (this.get_view_settings) {
					items.push(this.get_view_settings());
				}
			}

			return items;
		}

		get_view_settings() {
			var this$1 = this;

			return {
				label: __("List Settings", null, "Button in list view menu"),
				action: function () { return this$1.show_list_settings(); },
				standard: true,
			};
		}

		show_list_settings() {
			var this$1 = this;

			frappe.model.with_doctype(this.doctype, function () {
				new ListSettings({
					listview: this$1,
					doctype: this$1.doctype,
					settings: this$1.list_view_settings,
					meta: frappe.get_meta(this$1.doctype)
				});
			});
		}

		get_workflow_action_menu_items() {
			var this$1 = this;

			var workflow_actions = [];
			if (frappe.model.has_workflow(this.doctype)) {
				var actions = frappe.workflow.get_all_transition_actions(
					this.doctype
				);
				actions.forEach(function (action) {
					workflow_actions.push({
						label: __(action),
						name: action,
						action: function () {
							frappe.xcall(
								"frappe.model.workflow.bulk_workflow_approval",
								{
									docnames: this$1.get_checked_items(true),
									doctype: this$1.doctype,
									action: action,
								}
							);
						},
						is_workflow_action: true,
					});
				});
			}
			return workflow_actions;
		}

		toggle_workflow_actions() {
			var this$1 = this;

			if (!frappe.model.has_workflow(this.doctype)) { return; }
			var checked_items = this.get_checked_items();
			frappe
				.xcall("frappe.model.workflow.get_common_transition_actions", {
					docs: checked_items,
					doctype: this.doctype,
				})
				.then(function (actions) {
					Object.keys(this$1.workflow_action_items).forEach(function (key) {
						this$1.workflow_action_items[key].toggle(
							actions.includes(key)
						);
					});
				});
		}

		get_actions_menu_items() {
			var this$1 = this;

			var doctype = this.doctype;
			var actions_menu_items = [];
			var bulk_operations = new BulkOperations({ doctype: this.doctype });

			var is_field_editable = function (field_doc) {
				return (
					field_doc.fieldname &&
					frappe.model.is_value_type(field_doc) &&
					field_doc.fieldtype !== "Read Only" &&
					!field_doc.hidden &&
					!field_doc.read_only
				);
			};

			var has_editable_fields = function (doctype) {
				return frappe.meta
					.get_docfields(doctype)
					.some(function (field_doc) { return is_field_editable(field_doc); });
			};

			var has_submit_permission = function (doctype) {
				return frappe.perm.has_perm(doctype, 0, "submit");
			};

			// utility
			var bulk_assignment = function () {
				return {
					label: __("Assign To", null, "Button in list view actions menu"),
					action: function () { return bulk_operations.assign(
							this$1.get_checked_items(true),
							this$1.refresh
						); },
					standard: true,
				};
			};

			var bulk_assignment_rule = function () {
				return {
					label: __("Apply Assignment Rule", null, "Button in list view actions menu"),
					action: function () { return bulk_operations.apply_assignment_rule(
							this$1.get_checked_items(true),
							this$1.refresh
						); },
					standard: true,
				};
			};

			var bulk_add_tags = function () {
				return {
					label: __("Add Tags", null, "Button in list view actions menu"),
					action: function () { return bulk_operations.add_tags(
							this$1.get_checked_items(true),
							this$1.refresh
						); },
					standard: true,
				};
			};

			var bulk_printing = function () {
				return {
					label: __("Print", null, "Button in list view actions menu"),
					action: function () { return bulk_operations.print(this$1.get_checked_items()); },
					standard: true,
				};
			};

			var bulk_delete = function () {
				return {
					label: __("Delete", null, "Button in list view actions menu"),
					action: function () {
						var docnames = this$1.get_checked_items(true).map(
							function (docname) { return docname.toString(); }
						);
						frappe.confirm(
							__("Delete {0} items permanently?", [docnames.length], "Title of confirmation dialog"),
							function () { return bulk_operations.delete(docnames, this$1.refresh); }
						);
					},
					standard: true,
				};
			};

			var bulk_cancel = function () {
				return {
					label: __("Cancel", null, "Button in list view actions menu"),
					action: function () {
						var docnames = this$1.get_checked_items(true);
						if (docnames.length > 0) {
							frappe.confirm(
								__("Cancel {0} documents?", [docnames.length], "Title of confirmation dialog"),
								function () { return bulk_operations.submit_or_cancel(
										docnames,
										"cancel",
										this$1.refresh
									); }
							);
						}
					},
					standard: true,
				};
			};

			var bulk_submit = function () {
				return {
					label: __("Submit", null, "Button in list view actions menu"),
					action: function () {
						var docnames = this$1.get_checked_items(true);
						if (docnames.length > 0) {
							frappe.confirm(
								__("Submit {0} documents?", [docnames.length], "Title of confirmation dialog"),
								function () { return bulk_operations.submit_or_cancel(
										docnames,
										"submit",
										this$1.refresh
									); }
							);
						}
					},
					standard: true,
				};
			};

			var bulk_edit = function () {
				return {
					label: __("Edit", null, "Button in list view actions menu"),
					action: function () {
						var field_mappings = {};

						frappe.meta.get_docfields(doctype).forEach(function (field_doc) {
							if (is_field_editable(field_doc)) {
								field_mappings[field_doc.label] = Object.assign(
									{},
									field_doc
								);
							}
						});

						var docnames = this$1.get_checked_items(true);

						bulk_operations.edit(
							docnames,
							field_mappings,
							this$1.refresh
						);
					},
					standard: true,
				};
			};

			// bulk edit
			if (has_editable_fields(doctype)) {
				actions_menu_items.push(bulk_edit());
			}

			// bulk assignment
			actions_menu_items.push(bulk_assignment());

			actions_menu_items.push(bulk_assignment_rule());

			actions_menu_items.push(bulk_add_tags());

			// bulk printing
			if (frappe.model.can_print(doctype)) {
				actions_menu_items.push(bulk_printing());
			}

			// bulk submit
			if (
				frappe.model.is_submittable(doctype) &&
				has_submit_permission(doctype) &&
				!frappe.model.has_workflow(doctype)
			) {
				actions_menu_items.push(bulk_submit());
			}

			// bulk cancel
			if (
				frappe.model.can_cancel(doctype) &&
				!frappe.model.has_workflow(doctype)
			) {
				actions_menu_items.push(bulk_cancel());
			}

			// bulk delete
			if (frappe.model.can_delete(doctype)) {
				actions_menu_items.push(bulk_delete());
			}

			return actions_menu_items;
		}

		parse_filters_from_route_options() {
			var filters = [];

			for (var field in frappe.route_options) {
				var doctype = null;
				var value = frappe.route_options[field];

				var value_array = (void 0);
				if (
					$.isArray(value) &&
					value[0].startsWith("[") &&
					value[0].endsWith("]")
				) {
					value_array = [];
					for (var i = 0; i < value.length; i++) {
						value_array.push(JSON.parse(value[i]));
					}
				} else if (
					typeof value === "string" &&
					value.startsWith("[") &&
					value.endsWith("]")
				) {
					value = JSON.parse(value);
				}

				// if `Child DocType.fieldname`
				if (field.includes(".")) {
					doctype = field.split(".")[0];
					field = field.split(".")[1];
				}

				// find the table in which the key exists
				// for example the filter could be {"item_code": "X"}
				// where item_code is in the child table.

				// we can search all tables for mapping the doctype
				if (!doctype) {
					doctype = frappe.meta.get_doctype_for_field(
						this.doctype,
						field
					);
				}

				if (doctype) {
					if (value_array) {
						for (var j = 0; j < value_array.length; j++) {
							if ($.isArray(value_array[j])) {
								filters.push([
									doctype,
									field,
									value_array[j][0],
									value_array[j][1] ]);
							} else {
								filters.push([doctype, field, "=", value_array[j]]);
							}
						}
					} else if ($.isArray(value)) {
						filters.push([doctype, field, value[0], value[1]]);
					} else {
						filters.push([doctype, field, "=", value]);
					}
				}
			}

			return filters;
		}

		static trigger_list_update(data) {
			var doctype = data.doctype;
			if (!doctype) { return; }
			frappe.provide("frappe.views.trees");

			// refresh list view
			var page_name = frappe.get_route_str();
			var list_view = frappe.views.list_view[page_name];
			if (
				list_view && list_view.list_view_settings &&
				!list_view.list_view_settings.disable_auto_refresh
			) {
				list_view.on_update(data);
			}
		}
	};

	$(document).on("save", function (event, doc) {
		frappe.views.ListView.trigger_list_update(doc);
	});

	frappe.get_list_view = function (doctype) {
		var route = "List/" + doctype + "/List";
		return frappe.views.list_view[route];
	};

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt

	frappe.provide('frappe.views.list_view');

	window.cur_list = null;
	frappe.views.ListFactory = class ListFactory extends frappe.views.Factory {
		make(route) {
			var me = this;
			var doctype = route[1];

			frappe.model.with_doctype(doctype, function () {
				if (locals['DocType'][doctype].issingle) {
					frappe.set_re_route('Form', doctype);
				} else {
					// List / Gantt / Kanban / etc
					var view_name = frappe.utils.to_title_case(route[2] || 'List');

					// File is a special view
					if (doctype == "File" && !["Report", "Dashboard"].includes(view_name)) {
						view_name = "File";
					}

					var view_class = frappe.views[view_name + 'View'];
					if (!view_class) { view_class = frappe.views.ListView; }

					if (view_class && view_class.load_last_view && view_class.load_last_view()) {
						// view can have custom routing logic
						return;
					}

					frappe.provide('frappe.views.list_view.' + doctype);
					var page_name = frappe.get_route_str();

					if (!frappe.views.list_view[page_name]) {
						frappe.views.list_view[page_name] = new view_class({
							doctype: doctype,
							parent: me.make_page(true, page_name)
						});
					} else {
						frappe.container.change_to(page_name);
					}
					me.set_cur_list();
				}
			});
		}

		show() {
			if (this.re_route_to_view()) {
				return;
			}
			this.set_module_breadcrumb();
			super.show();
			this.set_cur_list();
			cur_list && cur_list.show();
		}

		re_route_to_view() {
			var route = frappe.get_route();
			var doctype = route[1];
			var last_route = frappe.route_history.slice(-2)[0];
			if (route[0] === 'List' && route.length === 2 && frappe.views.list_view[doctype]) {
				if(last_route && last_route[0]==='List' && last_route[1]===doctype) {
					// last route same as this route, so going back.
					// this happens because /app/List/Item will redirect to /app/List/Item/List
					// while coming from back button, the last 2 routes will be same, so
					// we know user is coming in the reverse direction (via back button)

					// example:
					// Step 1: /app/List/Item redirects to /app/List/Item/List
					// Step 2: User hits "back" comes back to /app/List/Item
					// Step 3: Now we cannot send the user back to /app/List/Item/List so go back one more step
					window.history.go(-1);
					return true;
				} else {
					return false;
				}
			}
		}

		set_module_breadcrumb() {
			if (frappe.route_history.length > 1) {
				var prev_route = frappe.route_history[frappe.route_history.length - 2];
				if (prev_route[0] === 'modules') {
					var doctype = frappe.get_route()[1],
						module = prev_route[1];
					if (frappe.module_links[module] && frappe.module_links[module].includes(doctype)) {
						// save the last page from the breadcrumb was accessed
						frappe.breadcrumbs.set_doctype_module(doctype, module);
					}
				}
			}
		}

		set_cur_list() {
			var route = frappe.get_route();
			var page_name = frappe.get_route_str();
			cur_list = frappe.views.list_view[page_name];
			if (cur_list && cur_list.doctype !== route[1]) {
				// changing...
				window.cur_list = null;
			}
		}
	};

	frappe.provide("frappe.views");

	frappe.views.ListViewSelect = class ListViewSelect {
		constructor(opts) {
			$.extend(this, opts);
			this.set_current_view();
			this.setup_views();
		}

		add_view_to_menu(view, action) {
			if (this.doctype == "File" && view == "List") {
				view = "File";
			}
			var $el = this.page.add_custom_menu_item(
				this.parent,
				__(view),
				action,
				true,
				null,
				this.icon_map[view] || "list"
			);
			$el.parent().attr("data-view", view);
		}

		set_current_view() {
			this.current_view = "List";
			var route = frappe.get_route();
			var view_name = frappe.utils.to_title_case(route[2] || "");
			if (route.length > 2 && frappe.views.view_modes.includes(view_name)) {
				this.current_view = view_name;

				if (this.current_view === "Kanban") {
					this.kanban_board = route[3];
				} else if (this.current_view === "Inbox") {
					this.email_account = route[3];
				}
			}
		}

		set_route(view, calendar_name) {
			var route = [this.slug(), "view", view];
			if (calendar_name) { route.push(calendar_name); }
			frappe.set_route(route);
		}

		setup_views() {
			var this$1 = this;

			var views = {
				List: {
					condition: true,
					action: function () { return this$1.set_route("list"); }
				},
				Report: {
					condition: true,
					action: function () { return this$1.set_route("report"); },
					current_view_handler: function () {
						var reports = this$1.get_reports();
						var default_action = {};
						// Only add action if current route is not report builder
						if (frappe.get_route().length > 3) {
							default_action = {
								label: __("Report Builder"),
								action: function () { return this$1.set_route("report"); }
							};
						}
						this$1.setup_dropdown_in_sidebar("Report", reports, default_action);
					}
				},
				Dashboard: {
					condition: true,
					action: function () { return this$1.set_route("dashboard"); }
				},
				Calendar: {
					condition: frappe.views.calendar[this.doctype],
					action: function () { return this$1.set_route("calendar", "default"); },
					current_view_handler: function () {
						this$1.get_calendars().then(function (calendars) {
							this$1.setup_dropdown_in_sidebar("Calendar", calendars);
						});
					}
				},
				Gantt: {
					condition: frappe.views.calendar[this.doctype],
					action: function () { return this$1.set_route("gantt"); }
				},
				Inbox: {
					condition:
						this.doctype === "Communication" &&
						frappe.boot.email_accounts.length,
					action: function () { return this$1.set_route("inbox"); },
					current_view_handler: function () {
						var accounts = this$1.get_email_accounts();
						var default_action;
						if (
							has_common(frappe.user_roles, [
								"System Manager",
								"Administrator"
							])
						) {
							default_action = {
								label: __("New Email Account"),
								action: function () { return frappe.new_doc("Email Account"); }
							};
						}
						this$1.setup_dropdown_in_sidebar(
							"Inbox",
							accounts,
							default_action
						);
					}
				},
				Image: {
					condition: this.list_view.meta.image_field,
					action: function () { return this$1.set_route("image"); }
				},
				Tree: {
					condition:
						frappe.treeview_settings[this.doctype] ||
						frappe.get_meta(this.doctype).is_tree,
					action: function () { return this$1.set_route("tree"); }
				},
				Kanban: {
					condition: this.doctype != "File",
					action: function () { return this$1.setup_kanban_boards(); },
					current_view_handler: function () {
						frappe.views.KanbanView.get_kanbans(this$1.doctype).then(
							function (kanbans) { return this$1.setup_kanban_switcher(kanbans); }
						);
					}
				},
				Map: {
					condition: this.list_view.settings.get_coords_method ||
						(this.list_view.meta.fields.find(function (i) { return i.fieldname === "latitude"; }) &&
						this.list_view.meta.fields.find(function (i) { return i.fieldname === "longitude"; })) ||
						(this.list_view.meta.fields.find(function (i) { return i.fieldname === 'location' && i.fieldtype == 'Geolocation'; })),
					action: function () { return this$1.set_route("map"); }
				},
			};

			frappe.views.view_modes.forEach(function (view) {
				if (this$1.current_view !== view && views[view].condition) {
					this$1.add_view_to_menu(view, views[view].action);
				}

				if (this$1.current_view == view) {
					views[view].current_view_handler &&
						views[view].current_view_handler();
				}
			});
		}

		setup_dropdown_in_sidebar(view, items, default_action) {
			if (!this.sidebar) { return; }
			var views_wrapper = this.sidebar.sidebar.find(".views-section");
			views_wrapper.find(".sidebar-label").html(("" + (__(view))));
			var $dropdown = views_wrapper.find(".views-dropdown");

			var placeholder = "" + (__("Select {0}", [__(view)]));
			var html = "";

			if (!items || !items.length) {
				html = "<div class=\"empty-state\">\n\t\t\t\t\t\t" + (__("No {0} Found", [__(view)])) + "\n\t\t\t\t</div>";
			} else {
				var page_name = this.get_page_name();
				items.map(function (item) {
					if (item.name.toLowerCase() == page_name.toLowerCase()) {
						placeholder = item.name;
					} else {
						html += "<li><a class=\"dropdown-item\" href=\"" + (item.route) + "\">" + (item.name) + "</a></li>";
					}
				});
			}

			views_wrapper.find(".selected-view").html(placeholder);

			if (default_action) {
				views_wrapper.find(".sidebar-action a").html(default_action.label);
				views_wrapper
					.find(".sidebar-action a")
					.click(function () { return default_action.action(); });
			}

			$dropdown.html(html);

			views_wrapper.removeClass("hide");
		}

		setup_kanban_switcher(kanbans) {
			var this$1 = this;

			var kanban_switcher = this.page.add_custom_button_group(
				__("Select Kanban"),
				null,
				this.list_view.$filter_section
			);

			kanbans.map(function (k) {
				this$1.page.add_custom_menu_item(
					kanban_switcher,
					k.name,
					function () { return this$1.set_route("kanban", k.name); },
					false
				);
			});

			this.page.add_custom_menu_item(
				kanban_switcher,
				__("Create New Kanban Board"),
				function () { return frappe.views.KanbanView.show_kanban_dialog(this$1.doctype); },
				true
			);
		}

		get_page_name() {
			return frappe.utils.to_title_case(
				frappe.get_route().slice(-1)[0] || ""
			);
		}

		get_reports() {
			var this$1 = this;

			// add reports linked to this doctype to the dropdown
			var added = [];
			var reports_to_add = [];

			var add_reports = function (reports) {
				reports.map(function (r) {
					if (!r.ref_doctype || r.ref_doctype == this$1.doctype) {
						var report_type =
							r.report_type === "Report Builder"
								? ("/app/list/" + (r.ref_doctype) + "/report")
								: "/app/query-report";

						var route =
							r.route || report_type + "/" + (r.title || r.name);

						if (added.indexOf(route) === -1) {
							// don't repeat
							added.push(route);
							reports_to_add.push({
								name: __(r.title || r.name),
								route: route
							});
						}
					}
				});
			};

			// from reference doctype
			if (this.list_view.settings.reports) {
				add_reports(this.list_view.settings.reports);
			}

			// Sort reports alphabetically
			var reports =
				Object.values(frappe.boot.user.all_reports).sort(function (a, b) { return a.title.localeCompare(b.title); }
				) || [];

			// from specially tagged reports
			add_reports(reports);

			return reports_to_add;
		}

		setup_kanban_boards() {
			var this$1 = this;

			function fetch_kanban_board(doctype) {
				frappe.db.get_value(
					"Kanban Board",
					{ reference_doctype: doctype },
					"name",
					function (board) {
						if (!$.isEmptyObject(board)) {
							frappe.set_route("list", doctype, "kanban", board.name);
						} else {
							frappe.views.KanbanView.show_kanban_dialog(doctype);
						}
					}
				);
			}

			var last_opened_kanban =
				frappe.model.user_settings[this.doctype]["Kanban"] &&
				frappe.model.user_settings[this.doctype]["Kanban"].last_kanban_board;
			if (!last_opened_kanban) {
				fetch_kanban_board(this.doctype);
			} else {
				frappe.db.exists("Kanban Board", last_opened_kanban).then(function (exists) {
					if (exists) {
						frappe.set_route("list", this$1.doctype, "kanban", last_opened_kanban);
					} else {
						fetch_kanban_board(this$1.doctype);
					}
				});
			}
		}

		get_calendars() {
			var this$1 = this;

			var doctype = this.doctype;
			var calendars = [];

			return frappe.db
				.get_list("Calendar View", {
					filters: {
						reference_doctype: doctype
					}
				})
				.then(function (result) {
					if (!(result && Array.isArray(result) && result.length)) { return; }

					if (frappe.views.calendar[this$1.doctype]) {
						// has standard calendar view
						calendars.push({
							name: "Default",
							route: ("/app/" + (this$1.slug()) + "/view/calendar/default")
						});
					}
					result.map(function (calendar) {
						calendars.push({
							name: calendar.name,
							route: ("/app/" + (this$1.slug()) + "/view/calendar/" + (calendar.name))
						});
					});

					return calendars;
				});
		}

		get_email_accounts() {
			var accounts_to_add = [];
			var accounts = frappe.boot.email_accounts;
			accounts.forEach(function (account) {
				var email_account =
					account.email_id == "All Accounts"
						? "All Accounts"
						: account.email_account;
				var route = "/app/communication/inbox/" + email_account;
				var display_name = [
					"All Accounts",
					"Sent Mail",
					"Spam",
					"Trash"
				].includes(account.email_id)
					? __(account.email_id)
					: account.email_account;

				accounts_to_add.push({
					name: display_name,
					route: route
				});
			});

			return accounts_to_add;
		}

		slug() {
			return frappe.router.slug(frappe.router.doctype_layout || this.doctype);
		}
	};

	frappe.provide('frappe.ui');

	class ListFilter {
		constructor(ref) {
		var wrapper = ref.wrapper;
		var doctype = ref.doctype;

			Object.assign(this, arguments[0]);
			this.can_add_global = frappe.user.has_role([
				'System Manager',
				'Administrator' ]);
			this.filters = [];
			this.make();
			this.bind();
			this.refresh();
		}

		make() {
			// init dom
			this.wrapper.html(("\n\t\t\t<li class=\"input-area\"></li>\n\t\t\t<li class=\"sidebar-action\">\n\t\t\t\t<a class=\"saved-filters-preview\">" + (__('Show Saved')) + "</a>\n\t\t\t</li>\n\t\t\t<div class=\"saved-filters\"></div>\n\t\t"));

			this.$input_area = this.wrapper.find('.input-area');
			this.$list_filters = this.wrapper.find('.list-filters');
			this.$saved_filters = this.wrapper.find('.saved-filters').hide();
			this.$saved_filters_preview = this.wrapper.find('.saved-filters-preview');
			this.saved_filters_hidden = true;

			this.filter_input = frappe.ui.form.make_control({
				df: {
					fieldtype: 'Data',
					placeholder: __('Filter Name'),
					input_class: 'input-xs',
				},
				parent: this.$input_area,
				render_input: 1,
			});

			this.is_global_input = frappe.ui.form.make_control({
				df: {
					fieldtype: 'Check',
					label: __('Is Global'),
				},
				parent: this.$input_area,
				render_input: 1,
			});
		}

		bind() {
			this.bind_save_filter();
			this.bind_toggle_saved_filters();
			this.bind_click_filter();
			this.bind_remove_filter();
		}

		refresh() {
			var this$1 = this;

			this.get_list_filters().then(function () {
				this$1.filters.length ? this$1.$saved_filters_preview.show() : this$1.$saved_filters_preview.hide();
				var html = this$1.filters.map(function (filter) { return this$1.filter_template(filter); });
				this$1.wrapper.find('.filter-pill').remove();
				this$1.$saved_filters.append(html);
			});
			this.is_global_input.toggle(false);
			this.filter_input.set_description('');
		}

		filter_template(filter) {
			return ("<div class=\"list-link filter-pill list-sidebar-button btn btn-default\" data-name=\"" + (filter.name) + "\">\n\t\t\t<a class=\"ellipsis filter-name\">" + (filter.filter_name) + "</a>\n\t\t\t<a class=\"remove\">" + (frappe.utils.icon('close')) + "</a>\n\t\t</div>");
		}

		bind_toggle_saved_filters() {
			var this$1 = this;

			this.wrapper.find('.saved-filters-preview').click(function () {
				this$1.toggle_saved_filters(this$1.saved_filters_hidden);
			});
		}

		toggle_saved_filters(show) {
			this.$saved_filters.toggle(show);
			var label = show ? __('Hide Saved') : __('Show Saved');
			this.wrapper.find('.saved-filters-preview').text(label);
			this.saved_filters_hidden = !this.saved_filters_hidden;
		}

		bind_click_filter() {
			var this$1 = this;

			this.wrapper.on('click', '.filter-pill .filter-name', function (e) {
				var $filter = $(e.currentTarget).parent('.filter-pill');
				this$1.set_applied_filter($filter);
				var name = $filter.attr('data-name');
				this$1.list_view.filter_area.clear().then(function () {
					this$1.list_view.filter_area.add(this$1.get_filters_values(name));
				});
			});
		}

		bind_remove_filter() {
			var this$1 = this;

			this.wrapper.on('click', '.filter-pill .remove', function (e) {
				var $li = $(e.currentTarget).closest('.filter-pill');
				var name = $li.attr('data-name');
				var applied_filters = this$1.get_filters_values(name);
				$li.remove();
				this$1.remove_filter(name).then(function () { return this$1.refresh(); });
				this$1.list_view.filter_area.remove_filters(applied_filters);
			});
		}

		bind_save_filter() {
			var this$1 = this;

			this.filter_input.$input.keydown(
				frappe.utils.debounce(function (e) {
					var value = this$1.filter_input.get_value();
					var has_value = Boolean(value);

					if (e.which === frappe.ui.keyCode['ENTER']) {
						if (!has_value || this$1.filter_name_exists(value)) { return; }

						this$1.filter_input.set_value('');
						this$1.save_filter(value).then(function () { return this$1.refresh(); });
						this$1.toggle_saved_filters(true);
					} else {
						var help_text = __('Press Enter to save');

						if (this$1.filter_name_exists(value)) {
							help_text = __('Duplicate Filter Name');
						}

						this$1.filter_input.set_description(has_value ? help_text : '');

						if (this$1.can_add_global) {
							this$1.is_global_input.toggle(has_value);
						}
					}
				}, 300)
			);
		}

		save_filter(filter_name) {
			return frappe.db.insert({
				doctype: 'List Filter',
				reference_doctype: this.list_view.doctype,
				filter_name: filter_name,
				for_user: this.is_global_input.get_value() ? '' : frappe.session.user,
				filters: JSON.stringify(this.get_current_filters()),
			});
		}

		remove_filter(name) {
			if (!name) { return; }
			return frappe.db.delete_doc('List Filter', name);
		}

		get_filters_values(name) {
			var filter = this.filters.find(function (filter) { return filter.name === name; });
			return JSON.parse(filter.filters || '[]');
		}

		get_current_filters() {
			return this.list_view.filter_area.get();
		}

		filter_name_exists(filter_name) {
			return (this.filters || []).find(function (f) { return f.filter_name === filter_name; });
		}

		get_list_filters() {
			var this$1 = this;

			if (frappe.session.user === 'Guest') { return Promise.resolve(); }
			return frappe.db
				.get_list('List Filter', {
					fields: ['name', 'filter_name', 'for_user', 'filters'],
					filters: { reference_doctype: this.list_view.doctype },
					or_filters: [
						['for_user', '=', frappe.session.user],
						['for_user', '=', ''] ],
				})
				.then(function (filters) {
					this$1.filters = filters || [];
				});
		}

		set_applied_filter($filter) {
			this.$saved_filters
				.find('.btn-primary-light')
				.toggleClass('btn-primary-light btn-default');
			$filter.toggleClass('btn-default btn-primary-light');
		}
	}

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
	frappe.provide('frappe.views');

	// opts:
	// stats = list of fields
	// doctype
	// parent
	// set_filter = function called on click

	frappe.views.ListSidebar = class ListSidebar {
		constructor(opts) {
			$.extend(this, opts);
			this.make();
		}

		make() {
			var this$1 = this;

			var sidebar_content = frappe.render_template("list_sidebar", { doctype: this.doctype });

			this.sidebar = $('<div class="list-sidebar overlay-sidebar hidden-xs hidden-sm"></div>')
				.html(sidebar_content)
				.appendTo(this.page.sidebar.empty());

			this.setup_list_filter();
			this.setup_list_group_by();

			// do not remove
			// used to trigger custom scripts
			$(document).trigger('list_sidebar_setup');

			if (this.list_view.list_view_settings && this.list_view.list_view_settings.disable_sidebar_stats) {
				this.sidebar.find('.list-tags').remove();
			} else {
				this.sidebar.find('.list-stats').on('click', function (e) {
					this$1.reload_stats();
				});
			}

		}

		setup_views() {
			var show_list_link = false;

			if (frappe.views.calendar[this.doctype]) {
				this.sidebar.find('.list-link[data-view="Calendar"]').removeClass("hide");
				this.sidebar.find('.list-link[data-view="Gantt"]').removeClass('hide');
				show_list_link = true;
			}
			//show link for kanban view
			this.sidebar.find('.list-link[data-view="Kanban"]').removeClass('hide');
			if (this.doctype === "Communication" && frappe.boot.email_accounts.length) {
				this.sidebar.find('.list-link[data-view="Inbox"]').removeClass('hide');
				show_list_link = true;
			}

			if (frappe.treeview_settings[this.doctype] || frappe.get_meta(this.doctype).is_tree) {
				this.sidebar.find(".tree-link").removeClass("hide");
			}

			this.current_view = 'List';
			var route = frappe.get_route();
			if (route.length > 2 && frappe.views.view_modes.includes(route[2])) {
				this.current_view = route[2];

				if (this.current_view === 'Kanban') {
					this.kanban_board = route[3];
				} else if (this.current_view === 'Inbox') {
					this.email_account = route[3];
				}
			}

			// disable link for current view
			this.sidebar.find('.list-link[data-view="' + this.current_view + '"] a')
				.attr('disabled', 'disabled').addClass('disabled');

			//enable link for Kanban view
			this.sidebar.find('.list-link[data-view="Kanban"] a, .list-link[data-view="Inbox"] a')
				.attr('disabled', null).removeClass('disabled');

			// show image link if image_view
			if (this.list_view.meta.image_field) {
				this.sidebar.find('.list-link[data-view="Image"]').removeClass('hide');
				show_list_link = true;
			}

			if (this.list_view.settings.get_coords_method ||
				(this.list_view.meta.fields.find(function (i) { return i.fieldname === "latitude"; }) &&
				this.list_view.meta.fields.find(function (i) { return i.fieldname === "longitude"; })) ||
				(this.list_view.meta.fields.find(function (i) { return i.fieldname === 'location' && i.fieldtype == 'Geolocation'; }))) {
				this.sidebar.find('.list-link[data-view="Map"]').removeClass('hide');
				show_list_link = true;
			}

			if (show_list_link) {
				this.sidebar.find('.list-link[data-view="List"]').removeClass('hide');
			}
		}

		setup_reports() {
			// add reports linked to this doctype to the dropdown
			var me = this;
			var added = [];
			var dropdown = this.page.sidebar.find('.reports-dropdown');
			var divider = false;

			var add_reports = function(reports) {
				$.each(reports, function(name, r) {
					if (!r.ref_doctype || r.ref_doctype == me.doctype) {
						var report_type = r.report_type === 'Report Builder' ?
							("List/" + (r.ref_doctype) + "/Report") : 'query-report';

						var route = r.route || report_type + '/' + (r.title || r.name);

						if (added.indexOf(route) === -1) {
							// don't repeat
							added.push(route);

							if (!divider) {
								me.get_divider().appendTo(dropdown);
								divider = true;
							}

							$('<li><a href="#' + route + '">' +
								__(r.title || r.name) + '</a></li>').appendTo(dropdown);
						}
					}
				});
			};

			// from reference doctype
			if (this.list_view.settings.reports) {
				add_reports(this.list_view.settings.reports);
			}

			// Sort reports alphabetically
			var reports = Object.values(frappe.boot.user.all_reports).sort(function (a,b) { return a.title.localeCompare(b.title); }) || [];

			// from specially tagged reports
			add_reports(reports);
		}

		setup_list_filter() {
			this.list_filter = new ListFilter({
				wrapper: this.page.sidebar.find('.list-filters'),
				doctype: this.doctype,
				list_view: this.list_view
			});
		}

		setup_kanban_boards() {
			var $dropdown = this.page.sidebar.find('.kanban-dropdown');
			frappe.views.KanbanView.setup_dropdown_in_sidebar(this.doctype, $dropdown);
		}


		setup_keyboard_shortcuts() {
			var this$1 = this;

			this.sidebar.find('.list-link > a, .list-link > .btn-group > a').each(function (i, el) {
				frappe.ui.keys
					.get_shortcut_group(this$1.page)
					.add($(el));
			});
		}

		setup_list_group_by() {
			this.list_group_by = new frappe.views.ListGroupBy({
				doctype: this.doctype,
				sidebar: this,
				list_view: this.list_view,
				page: this.page
			});
		}

		get_stats() {
			var me = this;
			frappe.call({
				method: 'frappe.desk.reportview.get_sidebar_stats',
				type: 'GET',
				args: {
					stats: me.stats,
					doctype: me.doctype,
					// wait for list filter area to be generated before getting filters, or fallback to default filters
					filters: (me.list_view.filter_area ? me.list_view.get_filters_for_args() : me.default_filters) || []
				},
				callback: function(r) {
					var stats = (r.message.stats || {})["_user_tags"] || [];
					me.render_stat(stats);
					var stats_dropdown = me.sidebar.find('.list-stats-dropdown');
					frappe.utils.setup_search(stats_dropdown, '.stat-link', '.stat-label');
				}
			});
		}

		render_stat(stats) {
			var this$1 = this;

			var args = {
				stats: stats,
				label: __("Tags")
			};

			var tag_list = $(frappe.render_template("list_sidebar_stat", args)).on("click", ".stat-link", function (e) {
				var fieldname = $(e.currentTarget).attr('data-field');
				var label = $(e.currentTarget).attr('data-label');
				var condition = "like";
				var existing = this$1.list_view.filter_area.filter_list.get_filter(fieldname);
				if (existing) {
					existing.remove();
				}
				if (label == "No Tags") {
					label = "%,%";
					condition = "not like";
				}
				this$1.list_view.filter_area.add(
					this$1.doctype,
					fieldname,
					condition,
					label
				);
			});

			this.sidebar.find(".list-stats-dropdown .stat-result").html(tag_list);
		}

		reload_stats() {
			this.sidebar.find(".stat-link").remove();
			this.sidebar.find(".stat-no-records").remove();
			this.get_stats();
		}
	};

	frappe.templates['list_sidebar'] = '<ul class="list-unstyled sidebar-menu user-actions hide">  <li class="divider"></li> </ul> <ul class="list-unstyled sidebar-menu">  <div class="sidebar-section views-section hide">   <li class="sidebar-label">   </li>   <div class="current-view">    <li class="list-link">     <a class="btn btn-default btn-sm list-sidebar-button"      data-toggle="dropdown"      aria-haspopup="true"      aria-expanded="false"      href="#"     >      <span class="selected-view ellipsis">      </span>      <span>       <svg class="icon icon-xs">        <use href="#icon-select"></use>       </svg>      </span>     </a>     <ul class="dropdown-menu views-dropdown" role="menu">     </ul>    </li>    <li class="sidebar-action">     <a class="view-action"></a>    </li>   </div>  </div>   <div class="sidebar-section filter-section">   <li class="sidebar-label">    {{ __("Filter By") }}   </li>    <div class="list-group-by">   </div>    <div class="list-tags">    <li class="list-stats list-link">     <a      class="btn btn-default btn-sm list-sidebar-button"      data-toggle="dropdown"      aria-haspopup="true"      aria-expanded="false"      href="#"     >      <span>{{ __("Tags") }}</span>      <span>       <svg class="icon icon-xs">        <use href="#icon-select"></use>       </svg>      </span>     </a>     <ul class="dropdown-menu list-stats-dropdown" role="menu">      <div class="dropdown-search">       <input type="text" placeholder={{__("Search") }} data-element="search" class="form-control input-xs">      </div>      <div class="stat-result">      </div>     </ul>    </li>    <li class="sidebar-action show-tags">     <a class="list-tag-preview">{{ __("Show Tags") }}</a>    </li>   </div>  </div>   <div class="sidebar-section save-filter-section">   <li class="sidebar-label">    {{ __("Save Filter") }}   </li>   <li class="list-filters list-link"></li> </ul> ';

	frappe.templates['list_sidebar_stat'] = ' {% if (!stats.length) { %} <li class="stat-no-records text-muted">{{ __("No records tagged.") }}</li> {% } else {  for (var i=0, l=stats.length; i < l; i++) {   var stat_label = stats[i][0];   var stat_count = stats[i][1]; %} <li>  <a class="stat-link dropdown-item" data-label="{{ stat_label %}" data-field="_user_tags" href="#" onclick="return false;">   <span class="stat-label">{{ __(stat_label) }}</span>   <span>{{ stat_count }}</span>  </a> </li>  {% } } %} ';

	frappe.provide('frappe.views');

	frappe.views.ListGroupBy = class ListGroupBy {
		constructor(opts) {
			$.extend(this, opts);
			this.make_wrapper();

			this.user_settings = frappe.get_user_settings(this.doctype);
			this.group_by_fields = ['assigned_to', 'owner'];
			if (this.user_settings.group_by_fields) {
				this.group_by_fields = this.group_by_fields.concat(
					this.user_settings.group_by_fields
				);
			}
			this.render_group_by_items();
			this.make_group_by_fields_modal();
			this.setup_dropdown();
			this.setup_filter_by();
		}

		make_group_by_fields_modal() {
			var this$1 = this;

			var d = new frappe.ui.Dialog({
				title: __('Select Filters'),
				fields: this.get_group_by_dropdown_fields(),
			});

			d.set_primary_action(__("Save"), function (ref) {
				var group_by_fields = ref.group_by_fields;

				frappe.model.user_settings.save(
					this$1.doctype,
					'group_by_fields',
					group_by_fields || null
				);
				this$1.group_by_fields = group_by_fields
					? ['assigned_to', 'owner' ].concat( group_by_fields)
					: ['assigned_to', 'owner'];
				this$1.render_group_by_items();
				this$1.setup_dropdown();
				d.hide();
			});

			d.$body.prepend(("\n\t\t\t<div class=\"filters-search\">\n\t\t\t\t<input type=\"text\"\n\t\t\t\t\tplaceholder=\"" + (__('Search')) + "\"\n\t\t\t\t\tdata-element=\"search\" class=\"form-control input-xs\">\n\t\t\t</div>\n\t\t"));

			this.page.sidebar.find('.add-list-group-by a').on('click', function () {
				frappe.utils.setup_search(d.$body, '.unit-checkbox', '.label-area');
				d.show();
			});
		}

		make_wrapper() {
			this.$wrapper = this.sidebar.sidebar.find('.list-group-by');
			var html = "\n\t\t\t<div class=\"list-group-by-fields\">\n\t\t\t</div>\n\t\t\t<li class=\"add-list-group-by sidebar-action\">\n\t\t\t\t<a class=\"add-group-by\">\n\t\t\t\t\t" + (__('Edit Filters')) + "\n\t\t\t\t</a>\n\t\t\t</li>\n\t\t";
			this.$wrapper.html(html);
		}

		render_group_by_items() {
			var this$1 = this;

			var get_item_html = function (fieldname) {
				var label, fieldtype;
				if (fieldname === 'assigned_to') {
					label = __('Assigned To');
				} else if (fieldname === 'owner') {
					label = __('Created By');
				} else {
					label = frappe.meta.get_label(this$1.doctype, fieldname);
					var docfield = frappe.meta.get_docfield(this$1.doctype, fieldname);
					if (!docfield) {
						return;
					}
					fieldtype = docfield.fieldtype;
				}

				return ("<li class=\"group-by-field list-link\">\n\t\t\t\t\t<a class=\"btn btn-default btn-sm list-sidebar-button\" data-toggle=\"dropdown\"\n\t\t\t\t\taria-haspopup=\"true\" aria-expanded=\"false\"\n\t\t\t\t\tdata-label=\"" + label + "\" data-fieldname=\"" + fieldname + "\" data-fieldtype=\"" + fieldtype + "\"\n\t\t\t\t\thref=\"#\" onclick=\"return false;\">\n\t\t\t\t\t\t<span class=\"ellipsis\">" + (__(label)) + "</span>\n\t\t\t\t\t\t<span>" + (frappe.utils.icon('select', 'xs')) + "</span>\n\t\t\t\t\t</a>\n\t\t\t\t\t<ul class=\"dropdown-menu group-by-dropdown\" role=\"menu\">\n\t\t\t\t\t</ul>\n\t\t\t</li>");
			};
			var html = this.group_by_fields.map(get_item_html).join('');
			this.$wrapper.find('.list-group-by-fields').html(html);
		}

		setup_dropdown() {
			var this$1 = this;

			this.$wrapper.find('.group-by-field').on('show.bs.dropdown', function (e) {
				var $dropdown = $(e.currentTarget).find('.group-by-dropdown');
				this$1.set_loading_state($dropdown);
				var fieldname = $(e.currentTarget).find('a')
					.attr('data-fieldname');
				var fieldtype = $(e.currentTarget)
					.find('a')
					.attr('data-fieldtype');
				this$1.get_group_by_count(fieldname).then(function (field_count_list) {
					if (field_count_list.length) {
						var applied_filter = this$1.list_view.get_filter_value(
							fieldname == 'assigned_to' ? '_assign' : fieldname
						);
						this$1.render_dropdown_items(
							field_count_list,
							fieldtype,
							$dropdown,
							applied_filter
						);
						this$1.setup_search($dropdown);
					} else {
						this$1.set_empty_state($dropdown);
					}
				});
			});
		}

		set_loading_state($dropdown) {
			$dropdown.html(("<li>\n\t\t\t<div class=\"empty-state group-by-loading\">\n\t\t\t\t" + (__('Loading...')) + "\n\t\t\t</div>\n\t\t</li>"));
		}

		set_empty_state($dropdown) {
			$dropdown.html(
				("<div class=\"empty-state group-by-empty\">\n\t\t\t\t" + (__('No filters found')) + "\n\t\t\t</div>")
			);
		}

		setup_search($dropdown) {
			frappe.utils.setup_search(
				$dropdown,
				'.group-by-item',
				'.group-by-value',
				'data-name'
			);
		}

		get_group_by_dropdown_fields() {
			var this$1 = this;

			var group_by_fields = [];
			var fields = this.list_view.meta.fields.filter(function (f) { return ['Select', 'Link', 'Data', 'Int', 'Check'].includes(f.fieldtype); }
			);
			group_by_fields.push({
				label: __(this.doctype),
				fieldname: 'group_by_fields',
				fieldtype: 'MultiCheck',
				columns: 2,
				options: fields.map(function (df) { return ({
					label: __(df.label),
					value: df.fieldname,
					checked: this$1.group_by_fields.includes(df.fieldname),
				}); }),
			});
			return group_by_fields;
		}

		get_group_by_count(field) {
			var current_filters = this.list_view.get_filters_for_args();

			// remove filter of the current field
			current_filters = current_filters.filter(
				function (f_arr) { return !f_arr.includes(field === 'assigned_to' ? '_assign' : field); }
			);

			var args = {
				doctype: this.doctype,
				current_filters: current_filters,
				field: field,
			};

			return frappe
				.call('frappe.desk.listview.get_group_by_count', args)
				.then(function (r) {
					var field_counts = r.message || [];
					field_counts = field_counts.filter(function (f) { return f.count !== 0; });
					var current_user = field_counts.find(
						function (f) { return f.name === frappe.session.user; }
					);
					field_counts = field_counts.filter(
						function (f) { return !['Guest', 'Administrator', frappe.session.user].includes(f.name); }
					);
					// Set frappe.session.user on top of the list
					if (current_user) { field_counts.unshift(current_user); }
					return field_counts;
				});
		}

		render_dropdown_items(fields, fieldtype, $dropdown, applied_filter) {
			var this$1 = this;

			var standard_html = "\n\t\t\t<div class=\"dropdown-search\">\n\t\t\t\t<input type=\"text\"\n\t\t\t\t\tplaceholder=\"" + (__('Search')) + "\"\n\t\t\t\t\tdata-element=\"search\"\n\t\t\t\t\tclass=\"dropdown-search-input form-control input-xs\"\n\t\t\t\t>\n\t\t\t</div>\n\t\t";
			var applied_filter_html='';
			var dropdown_items_html = '';

			fields.map(function (field) {
				if (field.name === applied_filter) {
					applied_filter_html = this$1.get_dropdown_html(field, fieldtype, true);
				} else {
					dropdown_items_html += this$1.get_dropdown_html(field, fieldtype);
				}
			});

			var dropdown_html = standard_html + applied_filter_html + dropdown_items_html;
			$dropdown.toggleClass('has-selected', Boolean(applied_filter_html));
			$dropdown.html(dropdown_html);
		}

		get_dropdown_html(field, fieldtype, applied) {
			if ( applied === void 0 ) applied=false;

			var label = field.name == null ? __('Not Set') : field.name;
			if (label === frappe.session.user) {
				label = __('Me');
			} else if (fieldtype && fieldtype == 'Check') {
				label = label == '0' ? __('No') : __('Yes');
			}
			var value = field.name == null ? '' : encodeURIComponent(field.name);

			var applied_html = applied ? ("<span class=\"applied\"> " + (frappe.utils.icon('tick', 'xs')) + " </span>") : '';
			return ("<li class=\"group-by-item " + (applied ? 'selected': '') + "\" data-value=\"" + value + "\">\n\t\t\t<a class=\"dropdown-item\" href=\"#\" onclick=\"return false;\">\n\t\t\t\t" + applied_html + "\n\t\t\t\t<span class=\"group-by-value ellipsis\" data-name=\"" + (field.name) + "\">" + label + "</span>\n\t\t\t\t<span class=\"group-by-count\">" + (field.count) + "</span>\n\t\t\t</a>\n\t\t</li>");
		}

		setup_filter_by() {
			var this$1 = this;

			this.$wrapper.on('click', '.group-by-item', function (e) {
				var $target = $(e.currentTarget);
				var is_selected = $target.hasClass('selected');

				var fieldname = $target
					.parents('.group-by-field')
					.find('a')
					.data('fieldname');
				var value =
					typeof $target.data('value') === 'string'
						? decodeURIComponent($target.data('value').trim())
						: $target.data('value');
				fieldname = fieldname === 'assigned_to' ? '_assign' : fieldname;

				return this$1.list_view.filter_area.remove(fieldname).then(function () {
					if (is_selected) { return; }
					return this$1.apply_filter(fieldname, value);
				});
			});
		}

		apply_filter(fieldname, value) {
			var operator = '=';
			if (value === '') {
				operator = 'is';
				value = 'not set';
			}
			if (fieldname === '_assign') {
				operator = 'like';
				value = "%" + value + "%";
			}
			return this.list_view.filter_area.add(
				this.doctype,
				fieldname,
				operator,
				value
			);
		}
	};

	frappe.templates['list_view_permission_restrictions'] = '<table class="table table-bordered" style="margin: 0;">  <thead>   <th>{{ __("Field") }}</th>   <th>{{ __("Value") }}</th>  </thead>  <tbody>   {% for (let condition of condition_list ) { %}    {% for (let key in condition) { %}    <tr>     <td>{{ __(key) }}</td>     <td>{{ frappe.utils.comma_or(condition[key]) }}</td>    </tr>    {% } %}   {% } %}  </tbody> </table> ';

	frappe.provide('frappe.views');

	frappe.views.GanttView = class GanttView extends frappe.views.ListView {
		get view_name() {
			return 'Gantt';
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults()
				.then(function () {
					this$1.page_title = this$1.page_title + ' ' + __('Gantt');
					this$1.calendar_settings = frappe.views.calendar[this$1.doctype] || {};

					if (typeof this$1.calendar_settings.gantt == 'object') {
						Object.assign(this$1.calendar_settings, this$1.calendar_settings.gantt);
					}

					if (this$1.calendar_settings.order_by) {
						this$1.sort_by = this$1.calendar_settings.order_by;
						this$1.sort_order = 'asc';
					} else {
						this$1.sort_by = this$1.view_user_settings.sort_by || this$1.calendar_settings.field_map.start;
						this$1.sort_order = this$1.view_user_settings.sort_order || 'asc';
					}
				})
		}

		setup_view() {

		}

		prepare_data(data) {
			super.prepare_data(data);
			this.prepare_tasks();
		}

		prepare_tasks() {
			var me = this;
			var meta = this.meta;
			var field_map = this.calendar_settings.field_map;

			this.tasks = this.data.map(function (item) {
				// set progress
				var progress = 0;
				if (field_map.progress && $.isFunction(field_map.progress)) {
					progress = field_map.progress(item);
				} else if (field_map.progress) {
					progress = item[field_map.progress];
				}

				// title
				var label;
				if (meta.title_field) {
					label = item.progress
						? __("{0} ({1}) - {2}%", [item[meta.title_field], item.name, item.progress])
						: __("{0} ({1})", [item[meta.title_field], item.name]);
				} else {
					label = item[field_map.title];
				}

				var r = {
					start: item[field_map.start],
					end: item[field_map.end],
					name: label,
					id: item[field_map.id || 'name'],
					doctype: me.doctype,
					progress: progress,
					dependencies: item.depends_on_tasks || ""
				};

				if (item.color && frappe.ui.color.validate_hex(item.color)) {
					r['custom_class'] = 'color-' + item.color.substr(1);
				}

				if (item.is_milestone) {
					r['custom_class'] = 'bar-milestone';
				}

				return r;
			});
		}

		render() {
			var this$1 = this;

			this.load_lib.then(function () {
				this$1.render_gantt();
			});
		}

		render_header() {

		}

		render_gantt() {
			var me = this;
			var gantt_view_mode = this.view_user_settings.gantt_view_mode || 'Day';
			var field_map = this.calendar_settings.field_map;
			var date_format = 'YYYY-MM-DD';

			this.$result.empty();
			this.$result.addClass('gantt-modern');

			this.gantt = new Gantt(this.$result[0], this.tasks, {
				bar_height: 35,
				bar_corner_radius: 4,
				resize_handle_width: 8,
				resize_handle_height: 28,
				resize_handle_corner_radius: 3,
				resize_handle_offset: 4,
				view_mode: gantt_view_mode,
				date_format: "YYYY-MM-DD",
				on_click: function (task) {
					frappe.set_route('Form', task.doctype, task.id);
				},
				on_date_change: function (task, start, end) {
					var obj;

					if (!me.can_write) { return; }
					frappe.db.set_value(task.doctype, task.id, ( obj = {}, obj[field_map.start] = moment(start).format(date_format), obj[field_map.end] = moment(end).format(date_format), obj ));
				},
				on_progress_change: function (task, progress) {
					var obj;

					if (!me.can_write) { return; }
					var progress_fieldname = 'progress';

					if ($.isFunction(field_map.progress)) {
						progress_fieldname = null;
					} else if (field_map.progress) {
						progress_fieldname = field_map.progress;
					}

					if (progress_fieldname) {
						frappe.db.set_value(task.doctype, task.id, ( obj = {}, obj[progress_fieldname] = parseInt(progress), obj ));
					}
				},
				on_view_change: function (mode) {
					// save view mode
					me.save_view_user_settings({
						gantt_view_mode: mode
					});
				},
				custom_popup_html: function (task) {
					var item = me.get_item(task.id);

					var html =
						"<div class=\"title\">" + (task.name) + "</div>\n\t\t\t\t\t<div class=\"subtitle\">" + (moment(task._start).format('MMM D')) + " - " + (moment(task._end).format('MMM D')) + "</div>";

					// custom html in doctype settings
					var custom = me.settings.gantt_custom_popup_html;
					if (custom && $.isFunction(custom)) {
						var ganttobj = task;
						html = custom(ganttobj, item);
					}
					return '<div class="details-container">' + html + '</div>';
				}
			});
			this.setup_view_mode_buttons();
			this.set_colors();
		}

		setup_view_mode_buttons() {
			var this$1 = this;

			// view modes (for translation) __("Day"), __("Week"), __("Month"),
			//__("Half Day"), __("Quarter Day")

			var $btn_group = this.$paging_area.find('.gantt-view-mode');
			if ($btn_group.length > 0) { return; }

			var view_modes = this.gantt.options.view_modes || [];
			var active_class = function (view_mode) { return this$1.gantt.view_is(view_mode) ? 'btn-info' : ''; };
			var html =
				"<div class=\"btn-group gantt-view-mode\">\n\t\t\t\t" + (view_modes.map(function (value) { return ("<button type=\"button\"\n\t\t\t\t\t\tclass=\"btn btn-default btn-sm btn-view-mode " + (active_class(value)) + "\"\n\t\t\t\t\t\tdata-value=\"" + value + "\">\n\t\t\t\t\t\t" + (__(value)) + "\n\t\t\t\t\t</button>"); }).join('')) + "\n\t\t\t</div>";

			this.$paging_area.find('.level-left').append(html);

			// change view mode asynchronously
			var change_view_mode = function (value) { return setTimeout(function () { return this$1.gantt.change_view_mode(value); }, 0); };

			this.$paging_area.on('click', '.btn-view-mode', function (e) {
				var $btn = $(e.currentTarget);
				this$1.$paging_area.find('.btn-view-mode').removeClass('btn-info');
				$btn.addClass('btn-info');

				var value = $btn.data().value;
				change_view_mode(value);
			});
		}

		set_colors() {
			var classes = this.tasks
				.map(function (t) { return t.custom_class; })
				.filter(function (c) { return c && c.startsWith('color-'); });

			var style = classes.map(function (c) {
				var class_name = c.replace('#', '');
				var bar_color = '#' + c.substr(6);
				var progress_color = frappe.ui.color.get_contrast_color(bar_color);
				return ("\n\t\t\t\t.gantt .bar-wrapper." + class_name + " .bar {\n\t\t\t\t\tfill: " + bar_color + ";\n\t\t\t\t}\n\t\t\t\t.gantt .bar-wrapper." + class_name + " .bar-progress {\n\t\t\t\t\tfill: " + progress_color + ";\n\t\t\t\t}\n\t\t\t");
			}).join("");

			style = "<style>" + style + "</style>";
			this.$result.prepend(style);
		}

		get_item(name) {
			return this.data.find(function (item) { return item.name === name; });
		}

		get required_libs() {
			return [
				"assets/frappe/node_modules/frappe-gantt/dist/frappe-gantt.css",
				"assets/frappe/node_modules/frappe-gantt/dist/frappe-gantt.min.js"
			];
		}
	};

	// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt

	frappe.provide("frappe.views.calendar");
	frappe.provide("frappe.views.calendars");

	frappe.views.CalendarView = class CalendarView extends frappe.views.ListView {
		static load_last_view() {
			var route = frappe.get_route();
			if (route.length === 3) {
				var doctype = route[1];
				var user_settings = frappe.get_user_settings(doctype)['Calendar'] || {};
				route.push(user_settings.last_calendar || 'default');
				frappe.set_route(route);
				return true;
			} else {
				return false;
			}
		}

		toggle_result_area() {}

		get view_name() {
			return 'Calendar';
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults()
				.then(function () {
					this$1.page_title = __('{0} Calendar', [this$1.page_title]);
					this$1.calendar_settings = frappe.views.calendar[this$1.doctype] || {};
					this$1.calendar_name = frappe.get_route()[3];
				});
		}

		setup_page() {
			this.hide_page_form = true;
			super.setup_page();
		}

		setup_view() {

		}

		before_render() {
			super.before_render();
			this.save_view_user_settings({
				last_calendar: this.calendar_name
			});
		}

		render() {
			var this$1 = this;

			if (this.calendar) {
				this.calendar.refresh();
				return;
			}

			this.load_lib
				.then(function () { return this$1.get_calendar_preferences(); })
				.then(function (options) {
					this$1.calendar = new frappe.views.Calendar(options);
				});
		}

		get_calendar_preferences() {
			var this$1 = this;

			var options = {
				doctype: this.doctype,
				parent: this.$result,
				page: this.page,
				list_view: this
			};
			var calendar_name = this.calendar_name;

			return new Promise(function (resolve) {
				if (calendar_name === 'default') {
					Object.assign(options, frappe.views.calendar[this$1.doctype]);
					resolve(options);
				} else {
					frappe.model.with_doc('Calendar View', calendar_name, function () {
						var doc = frappe.get_doc('Calendar View', calendar_name);
						if (!doc) {
							frappe.show_alert(__("{0} is not a valid Calendar. Redirecting to default Calendar.", [calendar_name.bold()]));
							frappe.set_route("List", this$1.doctype, "Calendar", "default");
							return;
						}
						Object.assign(options, {
							field_map: {
								id: "name",
								start: doc.start_date_field,
								end: doc.end_date_field,
								title: doc.subject_field,
								allDay: doc.all_day ? 1 : 0
							}
						});
						resolve(options);
					});
				}
			});
		}

		get required_libs() {
			var assets = [
				'assets/frappe/js/lib/fullcalendar/fullcalendar.min.css',
				'assets/frappe/js/lib/fullcalendar/fullcalendar.min.js' ];
			var user_language = frappe.boot.user.language;
			if (user_language && user_language !== 'en') {
				assets.push('assets/frappe/js/lib/fullcalendar/locale-all.js');
			}
			return assets;
		}
	};

	frappe.views.Calendar = Class.extend({
		init: function(options) {
			$.extend(this, options);
			this.get_default_options();
		},
		get_default_options: function() {
			var this$1 = this;

			return new Promise (function (resolve) {
				var defaultView = localStorage.getItem('cal_defaultView');
				var weekends = localStorage.getItem('cal_weekends');
				var defaults = {
					'defaultView': defaultView ? defaultView : "month",
					'weekends': weekends ? weekends : true
				};
				resolve(defaults);
			}).then(function (defaults) {
				this$1.make_page();
				this$1.setup_options(defaults);
				this$1.make();
				this$1.setup_view_mode_button(defaults);
				this$1.bind();
			});
		},
		make_page: function() {
			var me = this;

			// add links to other calendars
			me.page.clear_user_actions();
			$.each(frappe.boot.calendars, function(i, doctype) {
				if(frappe.model.can_read(doctype)) {
					me.page.add_menu_item(__(doctype), function() {
						frappe.set_route("List", doctype, "Calendar");
					});
				}
			});

			$(this.parent).on("show", function() {
				me.$cal.fullCalendar("refetchEvents");
			});
		},

		make: function() {
			this.$wrapper = this.parent;
			this.$cal = $("<div>").appendTo(this.$wrapper);
			this.footnote_area = frappe.utils.set_footnote(this.footnote_area, this.$wrapper,
				__("Select or drag across time slots to create a new event."));
			this.footnote_area.css({"border-top": "0px"});

			this.$cal.fullCalendar(this.cal_options);
			this.set_css();
		},
		setup_view_mode_button: function(defaults) {
			var me = this;
			$(me.footnote_area).find('.btn-weekend').detach();
			var btnTitle = (defaults.weekends) ? __('Hide Weekends') : __('Show Weekends');
			var btn = "<button class=\"btn btn-default btn-xs btn-weekend\">" + btnTitle + "</button>";
			me.footnote_area.append(btn);
		},
		set_localStorage_option: function(option, value) {
			localStorage.removeItem(option);
			localStorage.setItem(option, value);
		},
		bind: function() {
			var me = this;
			var btn_group = me.$wrapper.find(".fc-button-group");
			btn_group.on("click", ".btn", function() {
				var value = ($(this).hasClass('fc-agendaWeek-button')) ? 'agendaWeek' : (($(this).hasClass('fc-agendaDay-button')) ? 'agendaDay' : 'month');
				me.set_localStorage_option("cal_defaultView", value);
			});

			me.$wrapper.on("click", ".btn-weekend", function() {
				me.cal_options.weekends = !me.cal_options.weekends;
				me.$cal.fullCalendar('option', 'weekends', me.cal_options.weekends);
				me.set_localStorage_option("cal_weekends", me.cal_options.weekends);
				me.set_css();
				me.setup_view_mode_button(me.cal_options);
			});
		},
		set_css: function() {
			// flatify buttons
			this.$wrapper.find("button.fc-state-default")
				.removeClass("fc-state-default")
				.addClass("btn btn-default");

			this.$wrapper
				.find('.fc-month-button, .fc-agendaWeek-button, .fc-agendaDay-button')
				.wrapAll('<div class="btn-group" />');

			this.$wrapper.find('.fc-prev-button span')
				.attr('class', '').html(frappe.utils.icon('left'));
			this.$wrapper.find('.fc-next-button span')
				.attr('class', '').html(frappe.utils.icon('right'));

			this.$wrapper.find('.fc-today-button')
				.prepend(frappe.utils.icon('today'));

			this.$wrapper.find('.fc-day-number').wrap('<div class="fc-day"></div>');

			var btn_group = this.$wrapper.find(".fc-button-group");
			btn_group.find(".fc-state-active").addClass("active");

			btn_group.find(".btn").on("click", function() {
				btn_group.find(".btn").removeClass("active");
				$(this).addClass("active");
			});
		},
		field_map: {
			"id": "name",
			"start": "start",
			"end": "end",
			"allDay": "all_day",
		},
		color_map: {
			"danger": "red",
			"success": "green",
			"warning": "orange",
			"default": "blue"
		},
		get_system_datetime: function(date) {
			date._offset = (moment(date).tz(frappe.sys_defaults.time_zone)._offset);
			return frappe.datetime.convert_to_system_tz(date);
		},
		setup_options: function(defaults) {
			var me = this;
			defaults.meridiem = 'false';
			this.cal_options = {
				locale: frappe.boot.user.language || "en",
				header: {
					left: 'prev, title, next',
					right: 'today, month, agendaWeek, agendaDay'
				},
				editable: true,
				selectable: true,
				selectHelper: true,
				forceEventDuration: true,
				displayEventTime: true,
				defaultView: defaults.defaultView,
				weekends: defaults.weekends,
				nowIndicator: true,
				events: function(start, end, timezone, callback) {
					return frappe.call({
						method: me.get_events_method || "frappe.desk.calendar.get_events",
						type: "GET",
						args: me.get_args(start, end),
						callback: function(r) {
							var events = r.message || [];
							events = me.prepare_events(events);
							callback(events);
						}
					});
				},
				displayEventEnd: true,
				eventRender: function(event, element) {
					element.attr('title', event.tooltip);
				},
				eventClick: function(event) {
					// edit event description or delete
					var doctype = event.doctype || me.doctype;
					if(frappe.model.can_read(doctype)) {
						frappe.set_route("Form", doctype, event.name);
					}
				},
				eventDrop: function(event, delta, revertFunc) {
					me.update_event(event, revertFunc);
				},
				eventResize: function(event, delta, revertFunc) {
					me.update_event(event, revertFunc);
				},
				select: function(startDate, endDate, jsEvent, view) {
					if (view.name==="month" && (endDate - startDate)===86400000) {
						// detect single day click in month view
						return;
					}

					var event = frappe.model.get_new_doc(me.doctype);

					event[me.field_map.start] = me.get_system_datetime(startDate);

					if(me.field_map.end)
						{ event[me.field_map.end] = me.get_system_datetime(endDate); }

					if(me.field_map.allDay) {
						var all_day = (startDate._ambigTime && endDate._ambigTime) ? 1 : 0;

						event[me.field_map.allDay] = all_day;

						if (all_day)
							{ event[me.field_map.end] = me.get_system_datetime(moment(endDate).subtract(1, "s")); }
					}

					frappe.set_route("Form", me.doctype, event.name);
				},
				dayClick: function(date, jsEvent, view) {
					if(view.name === 'month') {
						var $date_cell = $('td[data-date=' + date.format('YYYY-MM-DD') + "]");

						if($date_cell.hasClass('date-clicked')) {
							me.$cal.fullCalendar('changeView', 'agendaDay');
							me.$cal.fullCalendar('gotoDate', date);
							me.$wrapper.find('.date-clicked').removeClass('date-clicked');

							// update "active view" btn
							me.$wrapper.find('.fc-month-button').removeClass('active');
							me.$wrapper.find('.fc-agendaDay-button').addClass('active');
						}

						me.$wrapper.find('.date-clicked').removeClass('date-clicked');
						$date_cell.addClass('date-clicked');
					}
					return false;
				}
			};

			if(this.options) {
				$.extend(this.cal_options, this.options);
			}
		},
		get_args: function(start, end) {
			var args = {
				doctype: this.doctype,
				start: this.get_system_datetime(start),
				end: this.get_system_datetime(end),
				fields: this.fields,
				filters: this.list_view.filter_area.get(),
				field_map: this.field_map
			};
			return args;
		},
		refresh: function() {
			this.$cal.fullCalendar('refetchEvents');
		},
		prepare_events: function(events) {
			var me = this;

			return (events || []).map(function (d) {
				d.id = d.name;
				d.editable = frappe.model.can_write(d.doctype || me.doctype);

				// do not allow submitted/cancelled events to be moved / extended
				if(d.docstatus && d.docstatus > 0) {
					d.editable = false;
				}

				$.each(me.field_map, function(target, source) {
					d[target] = d[source];
				});

				if(!me.field_map.allDay)
					{ d.allDay = 1; }

				// convert to user tz
				d.start = frappe.datetime.convert_to_user_tz(d.start);
				d.end = frappe.datetime.convert_to_user_tz(d.end);

				// show event on single day if start or end date is invalid
				if (!frappe.datetime.validate(d.start) && d.end) {
					d.start = frappe.datetime.add_days(d.end, -1);
				}

				if (d.start && !frappe.datetime.validate(d.end)) {
					d.end = frappe.datetime.add_days(d.start, 1);
				}

				me.fix_end_date_for_event_render(d);
				me.prepare_colors(d);

				d.title = frappe.utils.html2text(d.title);

				return d;
			});
		},
		prepare_colors: function(d) {
			var color, color_name;
			if(this.get_css_class) {
				color_name = this.color_map[this.get_css_class(d)] || 'blue';

				if (color_name.startsWith("#")) {
					color_name = frappe.ui.color.validate_hex(color_name) ?
						color_name : 'blue';
				}

				d.backgroundColor = frappe.ui.color.get(color_name, 'extra-light');
				d.textColor = frappe.ui.color.get(color_name, 'dark');
			} else {
				color = d.color;
				if (!frappe.ui.color.validate_hex(color) || !color) {
					color = frappe.ui.color.get('blue', 'extra-light');
				}
				d.backgroundColor = color;
				d.textColor = frappe.ui.color.get_contrast_color(color);
			}
			return d;
		},
		update_event: function(event, revertFunc) {
			var me = this;
			frappe.model.remove_from_locals(me.doctype, event.name);
			return frappe.call({
				method: me.update_event_method || "frappe.desk.calendar.update_event",
				args: me.get_update_args(event),
				callback: function(r) {
					if(r.exc) {
						frappe.show_alert(__("Unable to update event"));
						revertFunc();
					}
				},
				error: function() {
					revertFunc();
				}
			});
		},
		get_update_args: function(event) {
			var me = this;
			var args = {
				name: event[this.field_map.id]
			};

			args[this.field_map.start] = me.get_system_datetime(event.start);

			if(this.field_map.allDay)
				{ args[this.field_map.allDay] = (event.start._ambigTime && event.end._ambigTime) ? 1 : 0; }

			if(this.field_map.end) {
				if (!event.end) {
					event.end = event.start.add(1, "hour");
				}

				args[this.field_map.end] = me.get_system_datetime(event.end);

				if (args[this.field_map.allDay]) {
					args[this.field_map.end] = me.get_system_datetime(moment(event.end).subtract(1, "s"));
				}
			}

			args.doctype = event.doctype || this.doctype;

			return { args: args, field_map: this.field_map };
		},

		fix_end_date_for_event_render: function(event) {
			if (event.allDay) {
				// We use inclusive end dates. This workaround fixes the rendering of events
				event.start = event.start ? $.fullCalendar.moment(event.start).stripTime() : null;
				event.end = event.end ? $.fullCalendar.moment(event.end).add(1, "day").stripTime() : null;
			}
		}
	});

	frappe.provide('frappe.views');

	frappe.views.DashboardView = class DashboardView extends frappe.views.ListView {
		get view_name() {
			return 'Dashboard';
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults()
				.then(function () {
					this$1.page_title = __('{0} Dashboard', [__(this$1.doctype)]);
					this$1.dashboard_settings = frappe.get_user_settings(this$1.doctype)['dashboard_settings'] || null;
				});
		}

		render() {

		}

		setup_page() {
			this.hide_sidebar = true;
			this.hide_page_form = true;
			this.hide_filters = true;
			this.hide_sort_selector = true;
			super.setup_page();
		}

		setup_view() {
			if (this.chart_group || this.number_card_group) {
				return;
			}

			this.setup_dashboard_page();
			this.setup_dashboard_customization();
			this.make_dashboard();
		}

		setup_dashboard_customization() {
			var this$1 = this;

			this.page.add_menu_item(__('Customize Dashboard'), function () { return this$1.customize(); });
			this.page.add_menu_item(__('Reset Dashboard Customizations'), function () { return this$1.reset_dashboard_customization(); });
			this.add_customization_buttons();
		}

		setup_dashboard_page() {
			var chart_wrapper_html = "<div class=\"dashboard-view\"></div>";

			this.$frappe_list.html(chart_wrapper_html);
			this.page.clear_secondary_action();
			this.$dashboard_page = this.$page.find('.layout-main-section-wrapper').addClass('dashboard-page');
			this.page.main.removeClass('frappe-card');

			this.$dashboard_wrapper = this.$page.find('.dashboard-view');
			this.$chart_header = this.$page.find('.dashboard-header');

			frappe.utils.bind_actions_with_object(this.$dashboard_page, this);
		}

		add_customization_buttons() {
			var this$1 = this;

			this.save_customizations_button = this.page.add_button(
				__("Save Customizations"),
				function () {
					this$1.save_dashboard_customization();
					this$1.page.standard_actions.show();
				},
				{btn_class: 'btn-primary'}
			);

			this.discard_customizations_button = this.page.add_button(
				__("Discard"),
				function () {
					this$1.discard_dashboard_customization();
					this$1.page.standard_actions.show();
				}
			);

			this.toggle_customization_buttons(false);
		}

		set_primary_action() {
			// Don't render Add doc button for dashboard view
		}

		toggle_customization_buttons(show) {
			this.save_customizations_button.toggle(show);
			this.discard_customizations_button.toggle(show);
		}

		make_dashboard() {
			var this$1 = this;

			if (this.dashboard_settings) {
				this.charts = this.dashboard_settings.charts;
				this.number_cards = this.dashboard_settings.number_cards;
				this.render_dashboard();
			} else {
				frappe.run_serially([
					function () { return this$1.fetch_dashboard_items(
						'Dashboard Chart',
						{
							chart_type: ['in', ['Count', 'Sum', 'Group By']],
							document_type: this$1.doctype,
							is_public: 1,
						},
						'charts'
					); },
					function () { return this$1.fetch_dashboard_items('Number Card',
						{
							document_type: this$1.doctype,
							is_public: 1,
						},
						'number_cards'
					); },
					function () { return this$1.render_dashboard(); }
				]);
			}
		}

		render_dashboard() {
			var this$1 = this;

			this.$dashboard_wrapper.empty();

			frappe.dashboard_utils.get_dashboard_settings().then(function (settings) {
				this$1.dashboard_chart_settings = settings.chart_config ? JSON.parse(settings.chart_config) : {};
				this$1.charts.map(function (chart) {
					chart.label = chart.chart_name;
					chart.chart_settings = this$1.dashboard_chart_settings[chart.chart_name] || {};
				});
				this$1.render_dashboard_charts();
			});
			this.render_number_cards();

			if (!this.charts.length && !this.number_cards.length) {
				this.render_empty_state();
			}
		}

		fetch_dashboard_items(doctype, filters, obj_name) {
			var this$1 = this;

			return frappe.db.get_list(doctype, {
				filters: filters,
				fields: ['*']
			}).then(function (items) {
				this$1[obj_name] = items;
			});
		}

		render_number_cards() {
			this.number_card_group = new frappe.widget.WidgetGroup({
				container: this.$dashboard_wrapper,
				type: "number_card",
				columns: 3,
				options: {
					allow_sorting: true,
					allow_create: true,
					allow_delete: true,
					allow_hiding: true,
				},
				default_values: {doctype: this.doctype},
				widgets: this.number_cards || [],
				in_customize_mode: this.in_customize_mode || false,
			});

			this.in_customize_mode && this.number_card_group.customize();
		}

		render_dashboard_charts() {
			var this$1 = this;

			this.chart_group = new frappe.widget.WidgetGroup({
				container: this.$dashboard_wrapper,
				type: "chart",
				columns: 2,
				height: 240,
				options: {
					allow_sorting: true,
					allow_create: true,
					allow_delete: true,
					allow_hiding: true,
					allow_resize: true,
				},
				custom_dialog: function () { return this$1.show_add_chart_dialog(); },
				widgets: this.charts,
				in_customize_mode: this.in_customize_mode || false,
			});

			this.in_customize_mode && this.chart_group.customize();
			this.chart_group.container.find('.widget-group-head').hide();
		}

		render_empty_state() {
			var no_result_message_html =
				"<p>" + (__("You haven't added any Dashboard Charts or Number Cards yet.")) + "\n\t\t\t<br>" + (__("Click On Customize to add your first widget")) + "</p>";

			var customize_button =
				"<p><button class=\"btn btn-primary btn-sm\" data-action=\"customize\">\n\t\t\t\t" + (__('Customize')) + "\n\t\t\t</button></p>";

			var empty_state_image = '/assets/frappe/images/ui-states/list-empty-state.svg';

			var empty_state_html = "<div class=\"msg-box no-border empty-dashboard\">\n\t\t\t<div>\n\t\t\t\t<img src=\"" + empty_state_image + "\" alt=\"Generic Empty State\" class=\"null-state\">\n\t\t\t</div>\n\t\t\t" + no_result_message_html + "\n\t\t\t" + customize_button + "\n\t\t</div>";

			this.$dashboard_wrapper.append(empty_state_html);
			this.$empty_state = this.$dashboard_wrapper.find('.empty-dashboard');
		}

		customize() {
			if (this.in_customize_mode) {
				return;
			}

			this.page.standard_actions.hide();

			if (this.$empty_state) {
				this.$empty_state.remove();
			}

			this.toggle_customize(true);
			this.in_customize_mode = true;
			this.chart_group.customize();
			this.number_card_group.customize();
		}

		get_widgets_to_save(widget_group) {
			var config = widget_group.get_widget_config();
			var widgets = [];
			config.order.map(function (widget_name) {
				widgets.push(config.widgets[widget_name]);
			});
			return this.remove_duplicates(widgets);
		}

		save_dashboard_customization() {
			this.toggle_customize(false);

			var charts = this.get_widgets_to_save(this.chart_group);
			var number_cards = this.get_widgets_to_save(this.number_card_group);

			this.dashboard_settings = {
				charts: charts,
				number_cards: number_cards,
			};

			frappe.model.user_settings.save(this.doctype, 'dashboard_settings', this.dashboard_settings);
			this.make_dashboard();
		}

		discard_dashboard_customization() {
			this.dashboard_settings = frappe.get_user_settings(this.doctype)['dashboard_settings'] || null;
			this.toggle_customize(false);
			this.render_dashboard();
		}

		reset_dashboard_customization() {
			var this$1 = this;

			frappe.confirm(__("Are you sure you want to reset all customizations?"), function () {
				this$1.dashboard_settings = null;
				frappe.model.user_settings.save(
					this$1.doctype, 'dashboard_settings', this$1.dashboard_settings
				).then(function () { return this$1.make_dashboard(); });

				this$1.toggle_customize(false);
			});
		}

		toggle_customize(show) {
			this.toggle_customization_buttons(show);
			this.in_customize_mode = show;
		}

		show_add_chart_dialog() {
			var this$1 = this;

			var fields = this.get_field_options();
			var dialog = new frappe.ui.Dialog({
				title: __("Add a {0} Chart", [__(this.doctype)]),
				fields: [
					{
						fieldname: 'new_or_existing',
						fieldtype: 'Select',
						label: 'Choose an existing chart or create a new chart',
						options: ['New Chart', 'Existing Chart'],
						reqd: 1,
					},
					{
						label: 'Chart',
						fieldname: 'chart',
						fieldtype: 'Link',
						get_query: function () {
							return {
								'query': 'frappe.desk.doctype.dashboard_chart.dashboard_chart.get_charts_for_user',
								filters: {
									document_type: this$1.doctype,
								}
							};
						},
						options: 'Dashboard Chart',
						depends_on: 'eval: doc.new_or_existing == "Existing Chart"'
					},
					{
						fieldname: 'sb_2',
						fieldtype: 'Section Break',
						depends_on: 'eval: doc.new_or_existing == "New Chart"'
					},
					{
						label: 'Chart Label',
						fieldname: 'label',
						fieldtype: 'Data',
						mandatory_depends_on: 'eval: doc.new_or_existing == "New Chart"'
					},
					{
						fieldname: 'cb_1',
						fieldtype: 'Column Break'
					},
					{
						label: 'Chart Type',
						fieldname: 'chart_type',
						fieldtype: 'Select',
						options: ['Time Series', 'Group By'],
						mandatory_depends_on: 'eval: doc.new_or_existing == "New Chart"',
					},
					{
						fieldname: 'sb_2',
						fieldtype: 'Section Break',
						label: 'Chart Config',
						depends_on: 'eval: doc.chart_type == "Time Series" && doc.new_or_existing == "New Chart"',
					},
					{
						label: 'Function',
						fieldname: 'chart_function',
						fieldtype: 'Select',
						options: ['Count', 'Sum', 'Average'],
						default: 'Count',
					},
					{
						label: 'Timespan',
						fieldtype: 'Select',
						fieldname: 'timespan',
						depends_on: 'eval: doc.chart_type == "Time Series"',
						options: ['Last Year', 'Last Quarter', 'Last Month', 'Last Week'],
						default: 'Last Year',
					},
					{
						fieldname: 'cb_2',
						fieldtype: 'Column Break'
					},
					{
						label: 'Value Based On',
						fieldtype: 'Select',
						fieldname: 'based_on',
						options: fields.value_fields,
						depends_on: 'eval: doc.chart_function=="Sum"'
					},
					{
						label: 'Time Series Based On',
						fieldtype: 'Select',
						fieldname: 'based_on',
						options: fields.date_fields,
						mandatory_depends_on: 'eval: doc.chart_type == "Time Series"'
					},
					{
						label: 'Time Interval',
						fieldname: 'time_interval',
						fieldtype: 'Select',
						depends_on: 'eval: doc.chart_type == "Time Series"',
						options: ['Yearly', 'Quarterly', 'Monthly', 'Weekly', 'Daily'],
						default: 'Monthly'
					},
					{
						fieldname: 'sb_2',
						fieldtype: 'Section Break',
						label: 'Chart Config',
						depends_on: 'eval: doc.chart_type == "Group By" && doc.new_or_existing == "New Chart"',
					},
					{
						label: 'Group By Type',
						fieldname: 'group_by_type',
						fieldtype: 'Select',
						options: ['Count', 'Sum', 'Average'],
						default: 'Count',
					},
					{
						label: 'Aggregate Function Based On',
						fieldtype: 'Select',
						fieldname: 'aggregate_function_based_on',
						options: fields.aggregate_function_fields,
						depends_on: 'eval: ["Sum", "Avergage"].includes(doc.group_by_type)',
					},
					{
						fieldname: 'cb_2',
						fieldtype: 'Column Break'
					},
					{
						label: 'Group By Based On',
						fieldtype: 'Select',
						fieldname: 'group_by_based_on',
						options: fields.group_by_fields,
						default: 'Last Year',
					},
					{
						label: 'Number of Groups',
						fieldtype: 'Int',
						fieldname: 'number_of_groups',
						default: 0,
					},
					{
						fieldname: 'sb_3',
						fieldtype: 'Section Break',
						depends_on: 'eval: doc.new_or_existing == "New Chart"'
					},
					{
						label: 'Chart Type',
						fieldname: 'type',
						fieldtype: 'Select',
						options: ['Line', 'Bar', 'Percentage', 'Pie'],
						depends_on: 'eval: doc.new_or_existing == "New Chart"'
					},
					{
						fieldname: 'cb_1',
						fieldtype: 'Column Break'
					},
					{
						label: 'Chart Color',
						fieldname: 'color',
						fieldtype: 'Color',
						depends_on: 'eval: doc.new_or_existing == "New Chart"',
					} ],
				primary_action_label: __('Add'),
				primary_action: function (values) {
					var chart = values;
					if (chart.new_or_existing == 'New Chart') {
						chart.chart_name = chart.label;
						chart.chart_type = chart.chart_type == 'Time Series' ? chart.chart_function : chart.chart_type;
						chart.document_type = this$1.doctype;
						chart.filters_json = '[]';
						frappe.xcall('frappe.desk.doctype.dashboard_chart.dashboard_chart.create_dashboard_chart', {'args': chart}).then(function (doc){
							this$1.chart_group.new_widget.on_create({'chart_name': doc.chart_name, 'name': doc.chart_name, 'label': chart.label});
						});
					} else {
						this$1.chart_group.new_widget.on_create({'chart_name': chart.chart, 'label': chart.chart, 'name': chart.chart});
					}
					dialog.hide();
				}
			});
			dialog.show();
		}

		get_field_options() {
			var date_fields = [
				{label: __('Created On'), value: 'creation'},
				{label: __('Last Modified On'), value: 'modified'}
			];
			var value_fields = [];
			var group_by_fields = [];
			var aggregate_function_fields = [];

			frappe.get_meta(this.doctype).fields.map(function (df) {
				if (['Date', 'Datetime'].includes(df.fieldtype)) {
					date_fields.push({label: df.label, value: df.fieldname});
				}
				if (frappe.model.numeric_fieldtypes.includes(df.fieldtype)) {
					if (df.fieldtype == 'Currency') {
						if (!df.options || df.options !== 'Company:company:default_currency') {
							return;
						}
					}
					value_fields.push({label: df.label, value: df.fieldname});
					aggregate_function_fields.push({label: df.label, value: df.fieldname});
				}
				if (['Link', 'Select'].includes(df.fieldtype)) {
					group_by_fields.push({label: df.label, value: df.fieldname});
				}
			});

			return {
				date_fields: date_fields,
				value_fields: value_fields,
				group_by_fields: group_by_fields,
				aggregate_function_fields: aggregate_function_fields
			};
		}

		remove_duplicates(items) {
			return items.filter(function (item, index) { return items.indexOf(item) === index; });
		}

	};

	/**
	 * frappe.views.ImageView
	 */
	frappe.provide("frappe.views");

	frappe.views.ImageView = class ImageView extends frappe.views.ListView {
		get view_name() {
			return "Image";
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults().then(function () {
				this$1.page_title = this$1.page_title + " " + __("Images");
			});
		}

		setup_view() {
			this.setup_columns();
			this.setup_check_events();
			this.setup_like();
		}

		set_fields() {
			this.fields = [
				"name" ].concat( this.get_fields_in_list_view().map(function (el) { return el.fieldname; }),
				[this.meta.title_field],
				[this.meta.image_field],
				["_liked_by"]
			);
		}

		prepare_data(data) {
			var this$1 = this;

			super.prepare_data(data);
			this.items = this.data.map(function (d) {
				// absolute url if cordova, else relative
				d._image_url = this$1.get_image_url(d);
				return d;
			});
		}

		render() {
			var this$1 = this;

			this.get_attached_images().then(function () {
				this$1.render_image_view();

				if (!this$1.gallery) {
					this$1.setup_gallery();
				} else {
					this$1.gallery.prepare_pswp_items(this$1.items, this$1.images_map);
				}
			});
		}

		render_image_view() {
			var html = this.items.map(this.item_html.bind(this)).join("");

			this.$page.find(".layout-main-section-wrapper").addClass("image-view");

			this.$result.html(("\n\t\t\t<div class=\"image-view-container\">\n\t\t\t\t" + html + "\n\t\t\t</div>\n\t\t"));

			this.render_count();
		}

		item_details_html(item) {
			// TODO: Image view field in DocType
			var info_fields =
				this.get_fields_in_list_view().map(function (el) { return el.fieldname; }) || [];
			var title_field = this.meta.title_field || "name";
			info_fields = info_fields.filter(function (field) { return field !== title_field; });
			var info_html = "<div><ul class=\"list-unstyled image-view-info\">";
			var set = false;
			info_fields.forEach(function (field, index) {
				if (item[field] && !set) {
					if (index == 0) { info_html += "<li>" + (__(item[field])) + "</li>"; }
					else { info_html += "<li class=\"text-muted\">" + (__(item[field])) + "</li>"; }
					set = true;
				}
			});
			info_html += "</ul></div>";
			return info_html;
		}

		item_html(item) {
			item._name = encodeURI(item.name);
			var encoded_name = item._name;
			var status =encodeURI(item.online);
			var indic ='';
			(item.online == 'Online')? indic= "<p class=\"indicator-pill green\">"+status+"</p>" : indic= "<p class=\"indicator-pill red\">"+status+"</p>" 
			var title = strip_html(item[this.meta.title_field || "name"]);
			var escaped_title = frappe.utils.escape_html(title);
			var _class = !item._image_url ? "no-image" : "";
			var _html = item._image_url
				? ("<img data-name=\"" + encoded_name + "\" src=\"" + (item._image_url) + "\" alt=\"" + title + "\">")
				: ("<span class=\"placeholder-text\">\n\t\t\t\t" + (frappe.get_abbr(title)) + "\n\t\t\t</span>");

			var details = this.item_details_html(item);

			var expand_button_html = item._image_url
				? ("<div class=\"zoom-view\" data-name=\"" + encoded_name + "\">\n\t\t\t\t" + (frappe.utils.icon("expand", "xs")) + "\n\t\t\t</div>")
				: "";

			return ("\n\t\t\t<div class=\"image-view-item ellipsis\">"+indic+"\n\t\t\t\t<div class=\"image-view-header\">\n\t\t\t\t\t<div>\n\t\t\t\t\t\t<input class=\"level-item list-row-checkbox \"\n\t\t\t\t\t\t\ttype=\"checkbox\" data-name=\"" + status + (escape(item.name)) + "\">\n\t\t\t\t\t\t" + (this.get_like_html(item)) + "\n\t\t\t\t\t</div>\n\t\t\t\t</span>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"image-view-body " + _class + "\">\n\t\t\t\t\t<a data-name=\"" + encoded_name + "\"\n\t\t\t\t\t\ttitle=\"" + encoded_name + "\"\n\t\t\t\t\t\thref=\"" + (this.get_form_link(item)) + "\"\n\t\t\t\t\t>\n\t\t\t\t\t\t<div class=\"image-field\"\n\t\t\t\t\t\t\tdata-name=\"" + encoded_name + "\"\n\t\t\t\t\t\t>\n\t\t\t\t\t\t\t" + _html + "\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</a>\n\t\t\t\t\t" + expand_button_html + "\n\t\t\t\t</div>\n\t\t\t\t<div class=\"image-view-footer\">\n\t\t\t\t\t<div class=\"image-title\">\n\t\t\t\t\t\t<span class=\"ellipsis\" title=\"" + escaped_title + "\">\n\t\t\t\t\t\t\t<a class=\"ellipsis\" href=\"" + (this.get_form_link(item)) + "\"\n\t\t\t\t\t\t\t\ttitle=\"" + escaped_title + "\" data-doctype=\"" + (this.doctype) + "\" data-name=\"" + (item.name) + "\">\n\t\t\t\t\t\t\t\t" + title + "\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</span>\n\t\t\t\t\t</div>\n\t\t\t\t\t" + details + "\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t");
		}

		get_attached_images() {
			var this$1 = this;

			return frappe
				.call({
					method: "frappe.core.doctype.file.file.get_attached_images",
					args: {
						doctype: this.doctype,
						names: this.items.map(function (i) { return i.name; })
					}
				})
				.then(function (r) {
					this$1.images_map = Object.assign(
						this$1.images_map || {},
						r.message
					);
				});
		}

		get_header_html() {
			// return this.get_header_html_skeleton(`
			// 	<div class="list-image-header">
			// 		<div class="list-image-header-item">
			// 			<input class="level-item list-check-all hidden-xs" type="checkbox" title="Select All">
			// 			<div>${__(this.doctype)} &nbsp;</div>
			// 			(<span class="text-muted list-count"></span>)
			// 		</div>
			// 		<div class="list-image-header-item">
			// 			<div class="level-item list-liked-by-me">
			// 				${frappe.utils.icon('heart', 'sm', 'like-icon')}
			// 			</div>
			// 			<div>${__('Liked')}</div>
			// 		</div>
			// 	</div>
			// `);
		}

		setup_gallery() {
			var me = this;
			this.gallery = new frappe.views.GalleryView({
				doctype: this.doctype,
				items: this.items,
				wrapper: this.$result,
				images_map: this.images_map
			});
			this.$result.on("click", ".zoom-view", function(e) {
				e.preventDefault();
				e.stopPropagation();
				var name = $(this).data().name;
				name = decodeURIComponent(name);
				me.gallery.show(name);
				return false;
			});
		}
	};

	frappe.views.GalleryView = Class.extend({
		init: function(opts) {
			$.extend(this, opts);
			var me = this;

			this.lib_ready = this.load_lib();
			this.lib_ready.then(function() {
				me.prepare();
			});
		},
		prepare: function() {
			// keep only one pswp dom element
			this.pswp_root = $("body > .pswp");
			if (this.pswp_root.length === 0) {
				var pswp = frappe.render_template("photoswipe_dom");
				this.pswp_root = $(pswp).appendTo("body");
			}
		},
		prepare_pswp_items: function(_items, _images_map) {
			var this$1 = this;

			var me = this;

			if (_items) {
				// passed when more button clicked
				this.items = this.items.concat(_items);
				this.images_map = _images_map;
			}

			return new Promise(function (resolve) {
				var items = this$1.items.map(function(i) {
					var query = 'img[data-name="' + i._name + '"]';
					var el = me.wrapper.find(query).get(0);

					var width, height;
					if (el) {
						width = el.naturalWidth;
						height = el.naturalHeight;
					}

					if (!el) {
						el = me.wrapper
							.find('.image-field[data-name="' + i._name + '"]')
							.get(0);
						width = el.getBoundingClientRect().width;
						height = el.getBoundingClientRect().height;
					}

					return {
						src: i._image_url,
						msrc: i._image_url,
						name: i.name,
						w: width,
						h: height,
						el: el
					};
				});
				this$1.pswp_items = items;
				resolve();
			});
		},
		show: function(docname) {
			var this$1 = this;

			this.lib_ready
				.then(function () { return this$1.prepare_pswp_items(); })
				.then(function () { return this$1._show(docname); });
		},
		_show: function(docname) {
			var me = this;
			var items = this.pswp_items;
			var item_index = items.findIndex(function (item) { return item.name === docname; });

			var options = {
				index: item_index,
				getThumbBoundsFn: function(index) {
					var query = 'img[data-name="' + items[index]._name + '"]';
					var thumbnail = me.wrapper.find(query).get(0);

					if (!thumbnail) {
						return;
					}

					var pageYScroll =
							window.pageYOffset ||
							document.documentElement.scrollTop,
						rect = thumbnail.getBoundingClientRect();

					return {
						x: rect.left,
						y: rect.top + pageYScroll,
						w: rect.width
					};
				},
				history: false,
				shareEl: false,
				showHideOpacity: true
			};

			// init
			this.pswp = new PhotoSwipe(
				this.pswp_root.get(0),
				PhotoSwipeUI_Default,
				items,
				options
			);
			this.browse_images();
			this.pswp.init();
		},
		browse_images: function() {
			var this$1 = this;

			var $more_items = this.pswp_root.find(".pswp__more-items");
			var images_map = this.images_map;
			var last_hide_timeout = null;

			this.pswp.listen("afterChange", function() {
				var images = images_map[this.currItem.name];
				if (!images || images.length === 1) {
					$more_items.html("");
					return;
				}

				hide_more_items_after_2s();
				var html = images.map(img_html).join("");
				$more_items.html(html);
			});

			this.pswp.listen("beforeChange", hide_more_items);
			this.pswp.listen("initialZoomOut", hide_more_items);
			this.pswp.listen("destroy", function () {
				$(document).off("mousemove", hide_more_items_after_2s);
			});

			// Replace current image on click
			$more_items.on("click", ".pswp__more-item", function (e) {
				var img_el = e.target;
				var index = this$1.pswp.items.findIndex(
					function (i) { return i.name === this$1.pswp.currItem.name; }
				);

				this$1.pswp.goTo(index);
				this$1.pswp.items.splice(index, 1, {
					src: img_el.src,
					w: img_el.naturalWidth,
					h: img_el.naturalHeight,
					name: this$1.pswp.currItem.name
				});
				this$1.pswp.invalidateCurrItems();
				this$1.pswp.updateSize(true);
			});

			// hide more-images 2s after mousemove
			$(document).on("mousemove", hide_more_items_after_2s);

			function hide_more_items_after_2s() {
				clearTimeout(last_hide_timeout);
				show_more_items();
				last_hide_timeout = setTimeout(hide_more_items, 2000);
			}

			function show_more_items() {
				$more_items.show();
			}

			function hide_more_items() {
				$more_items.hide();
			}

			function img_html(src) {
				return ("<div class=\"pswp__more-item\">\n\t\t\t\t<img src=\"" + src + "\">\n\t\t\t</div>");
			}
		},
		load_lib: function() {
			return new Promise(function (resolve) {
				var asset_dir = "assets/frappe/js/lib/photoswipe/";
				frappe.require(
					[
						asset_dir + "photoswipe.css",
						asset_dir + "default-skin.css",
						asset_dir + "photoswipe.js",
						asset_dir + "photoswipe-ui-default.js"
					],
					resolve
				);
			});
		}
	});

	/**
	 * frappe.views.MapView
	 */
	frappe.provide('frappe.utils.utils');
	frappe.provide("frappe.views");

	frappe.views.MapView = class MapView extends frappe.views.ListView {
		get view_name() {
			return 'Map';
		}

		setup_defaults() {
			super.setup_defaults();
			this.page_title = __('{0} Map', [this.page_title]);
		}

		setup_view() {
		}

		on_filter_change() {
			this.get_coords();
		}

		render() {
			var this$1 = this;

			this.get_coords()
				.then(function () {
					this$1.render_map_view();
				});
			this.$paging_area.find('.level-left').append('<div></div>');
		}

		render_map_view() {
			var this$1 = this;

			this.map_id = frappe.dom.get_unique_id();

			this.$result.html(("<div id=\"" + (this.map_id) + "\" class=\"map-view-container\"></div>"));

			L.Icon.Default.imagePath = '/assets/frappe/images/leaflet/';
			this.map = L.map(this.map_id).setView(frappe.utils.map_defaults.center,
				frappe.utils.map_defaults.zoom);

			L.tileLayer(frappe.utils.map_defaults.tiles,
				frappe.utils.map_defaults.options).addTo(this.map);

			L.control.scale().addTo(this.map);
			if (this.coords.features && this.coords.features.length) {
				this.coords.features.forEach(
					function (coords) { return L.geoJSON(coords).bindPopup(coords.properties.name).addTo(this$1.map); }
				);
				var lastCoords = this.coords.features[0].geometry.coordinates.reverse();
				this.map.panTo(lastCoords, 8);
			}
		}

		get_coords() {
			var this$1 = this;

			var get_coords_method = this.settings && this.settings.get_coords_method || 'frappe.geo.utils.get_coords';

			if (cur_list.meta.fields.find(function (i) { return i.fieldname === 'location' && i.fieldtype === 'Geolocation'; })) {
				this.type = 'location_field';
			} else if  (cur_list.meta.fields.find(function (i) { return i.fieldname === "latitude"; }) &&
				cur_list.meta.fields.find(function (i) { return i.fieldname === "longitude"; })) {
				this.type = 'coordinates';
			}
			return frappe.call({
				method: get_coords_method,
				args: {
					doctype: this.doctype,
					filters: cur_list.filter_area.get(),
					type: this.type
				}
			}).then(function (r) {
				this$1.coords = r.message;

			});
		}


		get required_libs() {
			return [
				"assets/frappe/js/lib/leaflet/leaflet.css",
				"assets/frappe/js/lib/leaflet/leaflet.js"
			];
		}


	};

	class KanbanSettings {
		constructor(ref) {
		var this$1 = this;
		var kanbanview = ref.kanbanview;
		var doctype = ref.doctype;
		var meta = ref.meta;
		var settings = ref.settings;

			if (!doctype) {
				frappe.throw(__("DocType required"));
			}

			this.kanbanview = kanbanview;
			this.doctype = doctype;
			this.meta = meta;
			this.settings = settings;
			this.dialog = null;
			this.fields = this.settings && this.settings.fields;

			frappe.model.with_doctype("List View Settings", function () {
				this$1.make();
				this$1.get_fields();
				this$1.setup_fields();
				this$1.setup_remove_fields();
				this$1.add_new_fields();
				this$1.show_dialog();
			});
		}

		make() {
			var this$1 = this;

			this.dialog = new frappe.ui.Dialog({
				title: __("{0} Settings", [__(this.doctype)]),
				fields: [
					{
						fieldname: "show_labels",
						label: __("Show Labels"),
						fieldtype: "Check",
					},
					{
						fieldname: "fields_html",
						fieldtype: "HTML"
					},
					{
						fieldname: "fields",
						fieldtype: "Code",
						hidden: 1
					}
				]
			});
			this.dialog.set_values(this.settings);
			this.dialog.set_primary_action(__("Save"), function () {
				frappe.show_alert({
					message: __("Saving"),
					indicator: "green"
				});

				frappe.call({
					method:
						"frappe.desk.doctype.kanban_board.kanban_board.save_settings",
					args: {
						board_name: this$1.settings.name,
						settings: this$1.dialog.get_values()
					},
					callback: function (r) {
						this$1.kanbanview.board = r.message;
						this$1.kanbanview.render();
						this$1.dialog.hide();
					}
				});
			});
		}

		refresh() {
			this.setup_fields();
			this.add_new_fields();
			this.setup_remove_fields();
		}

		show_dialog() {
			if (!this.settings.fields) {
				this.update_fields();
			}

			this.dialog.show();
		}

		setup_fields() {
			var this$1 = this;

			var fields_html = this.dialog.get_field("fields_html");
			var wrapper = fields_html.$wrapper[0];
			var fields = "";

			for (var i = 0, list = this.fields; i < list.length; i += 1) {
				var fieldname = list[i];

				var field = this.get_docfield(fieldname);

				fields += "\n\t\t\t\t<div class=\"control-input flex align-center form-control fields_order sortable\"\n\t\t\t\t\tstyle=\"display: block; margin-bottom: 5px;\"\n\t\t\t\t\tdata-fieldname=\"" + (field.fieldname) + "\"\n\t\t\t\t\tdata-label=\"" + (field.label) + "\"\n\t\t\t\t\tdata-type=\"" + (field.type) + "\">\n\n\t\t\t\t\t<div class=\"row\">\n\t\t\t\t\t\t<div class=\"col-md-1\">\n\t\t\t\t\t\t\t" + (frappe.utils.icon("drag", "xs", "", "", "sortable-handle")) + "\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class=\"col-md-10\" style=\"padding-left:0px;\">\n\t\t\t\t\t\t\t" + (__(field.label)) + "\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class=\"col-md-1\">\n\t\t\t\t\t\t\t<a class=\"text-muted remove-field\" data-fieldname=\"" + (field.fieldname) + "\">\n\t\t\t\t\t\t\t\t" + (frappe.utils.icon("delete", "xs")) + "\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>";
			}

			fields_html.html(("\n\t\t\t<div class=\"form-group\">\n\t\t\t\t<div class=\"clearfix\">\n\t\t\t\t\t<label class=\"control-label\" style=\"padding-right: 0px;\">Fields</label>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"control-input-wrapper\">\n\t\t\t\t" + fields + "\n\t\t\t\t</div>\n\t\t\t\t<p class=\"help-box small text-muted\">\n\t\t\t\t\t<a class=\"add-new-fields text-muted\">\n\t\t\t\t\t\t+ Add / Remove Fields\n\t\t\t\t\t</a>\n\t\t\t\t</p>\n\t\t\t</div>\n\t\t"));

			new Sortable(
				wrapper.getElementsByClassName("control-input-wrapper")[0],
				{
					handle: ".sortable-handle",
					draggable: ".sortable",
					onUpdate: function (params) {
						this$1.fields.splice(
							params.newIndex,
							0,
							this$1.fields.splice(params.oldIndex, 1)[0]
						);
						this$1.dialog.set_value(
							"fields",
							JSON.stringify(this$1.fields)
						);
						this$1.refresh();
					}
				}
			);
		}

		add_new_fields() {
			var this$1 = this;

			var add_new_fields = this.get_dialog_fields_wrapper().getElementsByClassName(
				"add-new-fields"
			)[0];
			add_new_fields.onclick = function () { return this$1.show_column_selector(); };
		}

		setup_remove_fields() {
			var this$1 = this;

			var remove_fields = this.get_dialog_fields_wrapper().getElementsByClassName(
				"remove-field"
			);

			var loop = function ( idx ) {
				remove_fields.item(idx).onclick = function () { return this$1.remove_fields(
						remove_fields.item(idx).getAttribute("data-fieldname")
					); };
			};

			for (var idx = 0; idx < remove_fields.length; idx++) loop( idx );
		}

		get_dialog_fields_wrapper() {
			return this.dialog.get_field("fields_html").$wrapper[0];
		}

		remove_fields(fieldname) {
			this.fields = this.fields.filter(function (field) { return field !== fieldname; });
			this.dialog.set_value("fields", JSON.stringify(this.fields));
			this.refresh();
		}

		update_fields() {
			var wrapper = this.dialog.get_field("fields_html").$wrapper[0];
			var fields_order = wrapper.getElementsByClassName("fields_order");
			this.fields = [];

			for (var idx = 0; idx < fields_order.length; idx++) {
				this.fields.push(
					fields_order.item(idx).getAttribute("data-fieldname")
				);
			}

			this.dialog.set_value("fields", JSON.stringify(this.fields));
		}

		show_column_selector() {
			var this$1 = this;

			var dialog = new frappe.ui.Dialog({
				title: __("{0} Fields", [__(this.doctype)]),
				fields: [
					{
						label: __("Select Fields"),
						fieldtype: "MultiCheck",
						fieldname: "fields",
						options: this.get_multiselect_fields(),
						columns: 2
					}
				]
			});
			dialog.set_primary_action(__("Save"), function () {
				this$1.fields = dialog.get_values().fields || [];
				this$1.dialog.set_value("fields", JSON.stringify(this$1.fields));
				this$1.refresh();
				dialog.hide();
			});
			dialog.show();
		}

		get_fields() {
			this.fields = this.settings.fields;
			this.fields.uniqBy(function (f) { return f.fieldname; });
		}

		get_docfield(field_name) {
			return (
				frappe.meta.get_docfield(this.doctype, field_name) ||
				frappe.model.get_std_field(field_name)
			);
		}

		get_multiselect_fields() {
			var this$1 = this;

			var ignore_fields = [
				"idx",
				"lft",
				"rgt",
				"old_parent",
				"_user_tags",
				"_liked_by",
				"_comments",
				"_assign",
				this.meta.title_field || "name"
			];

			var ignore_fieldtypes = [
				"Attach Image",
				"Text Editor",
				"HTML Editor",
				"Code",
				"Color" ].concat( frappe.model.no_value_type
			);

			return frappe.model.std_fields
				.concat(this.kanbanview.get_fields_in_list_view())
				.filter(
					function (field) { return !ignore_fields.includes(field.fieldname) &&
						!ignore_fieldtypes.includes(field.fieldtype); }
				)
				.map(function (field) {
					return {
						label: __(field.label),
						value: field.fieldname,
						checked: this$1.fields.includes(field.fieldname)
					};
				});
		}
	}

	frappe.provide('frappe.views');

	frappe.views.KanbanView = class KanbanView extends frappe.views.ListView {
		static load_last_view() {
			var route = frappe.get_route();
			if (route.length === 3) {
				var doctype = route[1];
				var user_settings = frappe.get_user_settings(doctype)['Kanban'] || {};
				if (!user_settings.last_kanban_board) {
					frappe.msgprint({
						title: __('Error'),
						indicator: 'red',
						message: __('Missing parameter Kanban Board Name')
					});
					frappe.set_route('List', doctype, 'List');
					return true;
				}
				route.push(user_settings.last_kanban_board);
				frappe.set_route(route);
				return true;
			}
			return false;
		}

		get view_name() {
			return 'Kanban';
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults()
				.then(function () {
					this$1.board_name = frappe.get_route()[3];
					this$1.page_title = __(this$1.board_name);
					this$1.card_meta = this$1.get_card_meta();
					this$1.page_length = 0;

					this$1.menu_items.push({
						label: __('Save filters'),
						action: function () {
							this$1.save_kanban_board_filters();
						}
					});
					return this$1.get_board();
				});
		}

		setup_paging_area() {
			// pass
		}

		toggle_result_area() {
			this.$result.toggle(this.data.length > 0);
		}

		get_board() {
			var this$1 = this;

			return frappe.db.get_doc('Kanban Board', this.board_name)
				.then(function (board) {
					this$1.board = board;
					this$1.board.filters_array = JSON.parse(this$1.board.filters || '[]');
					this$1.board.fields = JSON.parse(this$1.board.fields || '[]');
					this$1.filters = this$1.board.filters_array;
				});
		}

		before_refresh() {

		}

		setup_page() {
			this.hide_sidebar = true;
			this.hide_page_form = true;
			this.hide_card_layout = true;
			super.setup_page();
		}

		setup_view() {
			if (this.board.columns.length > 5) {
				this.page.container.addClass('full-width');
			}
			this.setup_realtime_updates();
			this.setup_like();
		}

		set_fields() {
			super.set_fields();
			this._add_field(this.card_meta.title_field);
		}

		before_render() {
			frappe.model.user_settings.save(this.doctype, 'last_view', this.view_name);
			this.save_view_user_settings({
				last_kanban_board: this.board_name
			});
		}

		render_list() {

		}

		on_filter_change() {
			if (JSON.stringify(this.board.filters_array) !== JSON.stringify(this.filter_area.get())) {
				this.page.set_indicator(__('Not Saved'), 'orange');
			} else {
				this.page.clear_indicator();
			}
		}

		save_kanban_board_filters() {
			var this$1 = this;

			var filters = this.filter_area.get();

			frappe.call({
				method: 'frappe.desk.doctype.kanban_board.kanban_board.save_filters',
				args: {
					board_name: this.board_name,
					filters: filters
				}
			}).then(function (r) {
				if (r.exc) {
					frappe.show_alert({
						indicator: 'red',
						message: __('There was an error saving filters')
					});
					return;
				}
				frappe.show_alert({
					indicator: 'green',
					message: __('Filters saved')
				});

				this$1.board.filters_array = filters;
				this$1.on_filter_change();
			});
		}

		get_fields() {
			this.fields.push([this.board.field_name, this.board.reference_doctype]);
			return super.get_fields();
		}

		render() {
			var board_name = this.board_name;
			if (this.kanban && board_name === this.kanban.board_name) {
				this.kanban.update(this.data);
				return;
			}

			this.kanban = new frappe.views.KanbanBoard({
				doctype: this.doctype,
				board: this.board,
				board_name: board_name,
				cards: this.data,
				card_meta: this.card_meta,
				wrapper: this.$result,
				cur_list: this,
				user_settings: this.view_user_settings
			});
		}

		get_card_meta() {
			var meta = frappe.get_meta(this.doctype);
			var doc = frappe.model.get_new_doc(this.doctype);
			var title_field = null;
			var quick_entry = false;

			if (this.meta.title_field) {
				title_field = frappe.meta.get_field(this.doctype, this.meta.title_field);
			}

			this.meta.fields.forEach(function (df) {
				var is_valid_field =
					in_list(['Data', 'Text', 'Small Text', 'Text Editor'], df.fieldtype)
					&& !df.hidden;

				if (is_valid_field && !title_field) {
					// can be mapped to textarea
					title_field = df;
				}
			});

			// quick entry
			var mandatory = meta.fields.filter(function (df) { return df.reqd && !doc[df.fieldname]; });

			if (mandatory.some(function (df) { return frappe.model.table_fields.includes(df.fieldtype); }) || mandatory.length > 1) {
				quick_entry = true;
			}

			if (!title_field) {
				title_field = frappe.meta.get_field(this.doctype, 'name');
			}

			return {
				quick_entry: quick_entry,
				title_field: title_field
			};
		}

		get_view_settings() {
			var this$1 = this;

			return {
				label: __("Kanban Settings", null, "Button in kanban view menu"),
				action: function () { return this$1.show_kanban_settings(); },
				standard: true,
			};
		}

		show_kanban_settings() {
			var this$1 = this;

			frappe.model.with_doctype(this.doctype, function () {
				new KanbanSettings({
					kanbanview: this$1,
					doctype: this$1.doctype,
					settings: this$1.board,
					meta: frappe.get_meta(this$1.doctype)
				});
			});
		}

		get required_libs() {
			return [
				'assets/frappe/js/lib/fluxify.min.js',
				'assets/frappe/js/frappe/views/kanban/kanban_board.js'
			];
		}
	};


	frappe.views.KanbanView.get_kanbans = function (doctype) {
		var kanbans = [];

		return get_kanban_boards()
			.then(function (kanban_boards) {
				if (kanban_boards) {
					kanban_boards.forEach(function (board) {
						var route = "/app/" + (frappe.router.slug(board.reference_doctype)) + "/view/kanban/" + (board.name);
						kanbans.push({ name: board.name, route: route });
					});
				}

				return kanbans;
			});

		function get_kanban_boards() {
			return frappe.call('frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards', { doctype: doctype })
				.then(function (r) { return r.message; });
		}
	};


	frappe.views.KanbanView.show_kanban_dialog = function (doctype) {
		var dialog = new_kanban_dialog();
		dialog.show();

		function make_kanban_board(board_name, field_name, project) {
			return frappe.call({
				method: 'frappe.desk.doctype.kanban_board.kanban_board.quick_kanban_board',
				args: {
					doctype: doctype,
					board_name: board_name,
					field_name: field_name,
					project: project
				},
				callback: function (r) {
					var kb = r.message;
					if (kb.filters) {
						frappe.provide('frappe.kanban_filters');
						frappe.kanban_filters[kb.kanban_board_name] = kb.filters;
					}
					frappe.set_route('List', doctype, 'Kanban', kb.kanban_board_name);
				}
			});
		}

		function new_kanban_dialog() {
			/* Kanban dialog can show either "Save" or "Customize Form" option depending if any Select fields exist in the DocType for Kanban creation
			 */

			var select_fields = frappe.get_meta(doctype).fields.filter(function (df) {
				return df.fieldtype === "Select" && df.fieldname !== "kanban_column";
			});
			var dialog_fields = get_fields_for_dialog(select_fields);
			var to_save = select_fields.length > 0;
			var primary_action_label = to_save ? __("Save") : __("Customize Form");
			var dialog_title = to_save ? __("New Kanban Board") : __("No Select Field Found");

			var primary_action = function () {
				if (to_save) {
					var values = dialog.get_values();
					make_kanban_board(values.board_name, values.field_name, values.project).then(
						function () { return dialog.hide(); },
						function (err) { return frappe.msgprint(err); }
					);
				} else {
					frappe.set_route("Form", "Customize Form", {"doc_type": doctype});
				}
			};

			return new frappe.ui.Dialog({
				title: dialog_title,
				fields: dialog_fields,
				primary_action_label: primary_action_label,
				primary_action: primary_action
			});
		}


		function get_fields_for_dialog(select_fields) {
			if (!select_fields.length) {
				return [
					{
						fieldtype: "HTML",
						options: ("\n\t\t\t\t\t<div>\n\t\t\t\t\t\t<p class=\"text-medium\">\n\t\t\t\t\t\t" + (__(
								'No fields found that can be used as a Kanban Column. Use the Customize Form to add a Custom Field of type "Select".'
							)) + "\n\t\t\t\t\t\t</p>\n\t\t\t\t\t</div>\n\t\t\t\t"),
					} ];
			}

			var fields = [
				{
					fieldtype: "Data",
					fieldname: "board_name",
					label: __("Kanban Board Name"),
					reqd: 1,
					description: ["Note", "ToDo"].includes(doctype)
						? __("This Kanban Board will be private")
						: "",
				},
				{
					fieldtype: "Select",
					fieldname: "field_name",
					label: __("Columns based on"),
					options: select_fields.map(function (df) { return ({ label: df.label, value: df.fieldname }); }),
					default: select_fields[0],
					reqd: 1,
				} ];

			if (doctype === 'Task') {
				fields.push({
					fieldtype: 'Link',
					fieldname: 'project',
					label: __('Project'),
					options: 'Project'
				});
			}

			return fields;
		}
	};

	/**
	 * frappe.views.InboxView
	 */

	frappe.provide("frappe.views");

	frappe.views.InboxView = class InboxView extends frappe.views.ListView {
		static load_last_view() {
			var route = frappe.get_route();
			if (!route[3] && frappe.boot.email_accounts.length) {
				var email_account;
				if (frappe.boot.email_accounts[0].email_id == "All Accounts") {
					email_account = "All Accounts";
				} else {
					email_account = frappe.boot.email_accounts[0].email_account;
				}
				frappe.set_route("List", "Communication", "Inbox", email_account);
				return true;
			} else if (!route[3] || (route[3] !== "All Accounts" && !is_valid(route[3]))) {
				frappe.throw(__('No email account associated with the User. Please add an account under User > Email Inbox.'));
			}
			return false;

			function is_valid(email_account) {
				return frappe.boot.email_accounts.find(function (d) { return d.email_account === email_account; });
			}
		}

		get view_name() {
			return 'Inbox';
		}

		show() {
			super.show();
			// save email account in user_settings
			this.save_view_user_settings({
				last_email_account: this.current_email_account
			});
		}

		setup_defaults() {
			super.setup_defaults();

			// initialize with saved order by
			this.sort_by = this.view_user_settings.sort_by || 'communication_date';
			this.sort_order = this.view_user_settings.sort_order || 'desc';

			this.email_account = frappe.get_route()[3];
			this.page_title = this.email_account;
			this.filters = this.get_inbox_filters();
		}

		setup_columns() {
			// setup columns for list view
			this.columns = [];
			this.columns.push({
				type: 'Subject',
				df: {
					label: __('Subject'),
					fieldname: 'subject'
				}
			});
			this.columns.push({
				type: 'Field',
				df: {
					label: this.is_sent_emails ? __("To") : __("From"),
					fieldname: this.is_sent_emails ? 'recipients' : 'sender'
				}
			});
		}

		get_seen_class(doc) {
			var seen =
				Boolean(doc.seen) || JSON.parse(doc._seen || '[]').includes(frappe.session.user)
					? ''
					: 'bold';
			return seen;
		}

		get is_sent_emails() {
			var f = this.filter_area.get()
				.find(function (filter) { return filter[1] === 'sent_or_received'; });
			return f && f[3] === 'Sent';
		}

		render_header() {
			this.$result.find('.list-row-head').remove();
			this.$result.prepend(this.get_header_html());
		}

		render() {
			this.setup_columns();
			this.render_header();
			this.render_list();
			this.on_row_checked();
			this.render_count();
		}

		get_meta_html(email) {
			var attachment = email.has_attachment ?
				("<span class=\"fa fa-paperclip fa-large\" title=\"" + (__('Has Attachments')) + "\"></span>") : '';

			var link = "";
			if (email.reference_doctype && email.reference_doctype !== this.doctype) {
				link = "<a class=\"text-muted grey\"\n\t\t\t\thref=\"" + (frappe.utils.get_form_link(email.reference_doctype, email.reference_name)) + "\"\n\t\t\t\ttitle=\"" + (__('Linked with {0}', [email.reference_doctype])) + "\">\n\t\t\t\t<i class=\"fa fa-link fa-large\"></i>\n\t\t\t</a>";
			}

			var communication_date = comment_when(email.communication_date, true);
			var status =
				email.status == "Closed" ? ("<span class=\"fa fa-check fa-large\" title=\"" + (__(email.status)) + "\"></span>") :
					email.status == "Replied" ? ("<span class=\"fa fa-mail-reply fa-large\" title=\"" + (__(email.status)) + "\"></span>") :
						"";

			return ("\n\t\t\t<div class=\"level-item list-row-activity\">\n\t\t\t\t" + link + "\n\t\t\t\t" + attachment + "\n\t\t\t\t" + status + "\n\t\t\t\t" + communication_date + "\n\t\t\t</div>\n\t\t");
		}

		get_inbox_filters() {
			var email_account = this.email_account;
			var default_filters = [
				["Communication", "communication_type", "=", "Communication", true],
				["Communication", "communication_medium", "=", "Email", true] ];
			var filters = [];
			if (email_account === "Sent") {
				filters = default_filters.concat([
					["Communication", "sent_or_received", "=", "Sent", true],
					["Communication", "email_status", "not in", "Spam,Trash", true] ]);
			} else if (in_list(["Spam", "Trash"], email_account)) {
				filters = default_filters.concat([
					["Communication", "email_status", "=", email_account, true],
					["Communication", "email_account", "in", frappe.boot.all_accounts, true]
				]);
			} else {
				var op = "=";
				if (email_account == "All Accounts") {
					op = "in";
					email_account = frappe.boot.all_accounts;
				}

				filters = default_filters.concat([
					["Communication", "sent_or_received", "=", "Received", true],
					["Communication", "status", "=", "Open", true],
					["Communication", "email_account", op, email_account, true],
					["Communication", "email_status", "not in", "Spam,Trash", true] ]);
			}

			return filters;
		}

		get_no_result_message() {
			var email_account = this.email_account;
			var args;
			if (in_list(["Spam", "Trash"], email_account)) {
				return __("No {0} mail", [email_account]);
			} else if (!email_account && !frappe.boot.email_accounts.length) {
				// email account is not configured
				args = {
					doctype: "Email Account",
					msg: __("No Email Account"),
					label: __("New Email Account"),
				};
			} else {
				// no sent mail
				args = {
					doctype: "Communication",
					msg: __("No Emails"),
					label: __("Compose Email")
				};
			}

			var html = frappe.model.can_create(args.doctype) ?
				("<p>" + (args.msg) + "</p>\n\t\t\t<p>\n\t\t\t\t<button class=\"btn btn-primary btn-sm btn-new-doc\">\n\t\t\t\t\t" + (args.label) + "\n\t\t\t\t</button>\n\t\t\t</p>\n\t\t\t") :
				("<p>" + (__("No Email Accounts Assigned")) + "</p>");

			return ("\n\t\t\t<div class=\"msg-box no-border\">\n\t\t\t\t" + html + "\n\t\t\t</div>\n\t\t");
		}

		make_new_doc() {
			if (!this.email_account && !frappe.boot.email_accounts.length) {
				frappe.route_options = {
					'email_id': frappe.session.user_email
				};
				frappe.new_doc('Email Account');
			} else {
				new frappe.views.CommunicationComposer();
			}
		}
	};

	frappe.provide("frappe.views");

	frappe.views.FileView = class FileView extends frappe.views.ListView {
		static load_last_view() {
			var route = frappe.get_route();
			if (route.length === 2) {
				var view_user_settings = frappe.get_user_settings("File", "File");
				frappe.set_route(
					"List",
					"File",
					view_user_settings.last_folder || frappe.boot.home_folder
				);
				return true;
			}
			return redirect_to_home_if_invalid_route();
		}

		get view_name() {
			return "File";
		}

		show() {
			if (!redirect_to_home_if_invalid_route()) {
				super.show();
			}
		}

		setup_view() {
			var this$1 = this;

			this.render_header();
			this.setup_events();
			this.$page.find(".layout-main-section-wrapper").addClass("file-view");
			this.add_file_action_buttons();
			this.page.add_button(__("Toggle Grid View"), function () {
				frappe.views.FileView.grid_view = !frappe.views.FileView.grid_view;
				this$1.refresh();
			});
		}

		setup_no_result_area() {
			this.$no_result = $(("<div class=\"no-result\">\n\t\t\t<div class=\"breadcrumbs\">" + (this.get_breadcrumbs_html()) + "</div>\n\t\t\t<div class=\"text-muted flex justify-center align-center\">\n\t\t\t\t" + (this.get_no_result_message()) + "\n\t\t\t</div>\n\t\t</div>")).hide();
			this.$frappe_list.append(this.$no_result);
		}

		get_args() {
			var args = super.get_args();
			if (frappe.views.FileView.grid_view) {
				Object.assign(args, {
					order_by: ("is_folder desc, " + (this.sort_by) + " " + (this.sort_order))
				});
			}
			return args;
		}

		set_breadcrumbs() {
			var route = frappe.get_route();
			route.splice(-1);
			var last_folder = route[route.length - 1];
			if (last_folder === "File") { return; }

			frappe.breadcrumbs.add({
				type: "Custom",
				label: __("Home"),
				route: "/app/List/File/Home"
			});
		}

		setup_defaults() {
			var this$1 = this;

			return super.setup_defaults().then(function () {
				this$1.page_title = __("File Manager");

				var route = frappe.get_route();
				this$1.current_folder = route.slice(2).join("/");
				this$1.filters = [["File", "folder", "=", this$1.current_folder, true]];
				this$1.order_by = this$1.view_user_settings.order_by || "file_name asc";

				this$1.menu_items = this$1.menu_items.concat(this$1.file_menu_items());
			});
		}

		file_menu_items() {
			var this$1 = this;

			var items = [
				{
					label: __("Home"),
					action: function () {
						frappe.set_route("List", "File", "Home");
					}
				},
				{
					label: __("New Folder"),
					action: function () {
						frappe.prompt(
							__("Name"),
							function (values) {
								if (values.value.indexOf("/") > -1) {
									frappe.throw(
										__(
											"Folder name should not include '/' (slash)"
										)
									);
								}
								var data = {
									file_name: values.value,
									folder: this$1.current_folder
								};
								frappe.call({
									method:
										"frappe.core.doctype.file.file.create_new_folder",
									args: data
								});
							},
							__("Enter folder name"),
							__("Create")
						);
					}
				},
				{
					label: __("Import Zip"),
					action: function () {
						new frappe.ui.FileUploader({
							folder: this$1.current_folder,
							restrictions: {
								allowed_file_types: [".zip"]
							},
							on_success: function (file) {
								frappe.show_alert(__("Unzipping files..."));
								frappe
									.call(
										"frappe.core.doctype.file.file.unzip_file",
										{
											name: file.name
										}
									)
									.then(function (r) {
										if (r.message) {
											frappe.show_alert(
												__("Unzipped {0} files", [
													r.message
												])
											);
										}
									});
							}
						});
					}
				}
			];

			return items;
		}

		add_file_action_buttons() {
			var this$1 = this;

			this.$cut_button = this.page
				.add_button(__("Cut"), function () {
					frappe.file_manager.cut(
						this$1.get_checked_items(),
						this$1.current_folder
					);
					this$1.$checks.parents(".file-wrapper").addClass("cut");
				})
				.hide();

			this.$paste_btn = this.page
				.add_button(__("Paste"), function () { return frappe.file_manager.paste(this$1.current_folder); }
				)
				.hide();
		}

		set_fields() {
			this.fields = this.meta.fields
				.filter(
					function (df) { return frappe.model.is_value_type(df.fieldtype) && !df.hidden; }
				)
				.map(function (df) { return df.fieldname; })
				.concat(["name", "modified", "creation"]);
		}

		prepare_data(data) {
			var this$1 = this;

			super.prepare_data(data);

			this.data = this.data.map(function (d) { return this$1.prepare_datum(d); });

			// Bring folders to the top
			var ref = this.sort_selector;
			var sort_by = ref.sort_by;
			if (sort_by === "file_name") {
				this.data.sort(function (a, b) {
					if (a.is_folder && !b.is_folder) {
						return -1;
					}
					if (!a.is_folder && b.is_folder) {
						return 1;
					}
					return 0;
				});
			}
		}

		prepare_datum(d) {
			var icon_class = "";
			var type = "";
			if (d.is_folder) {
				icon_class = "folder-normal";
				type = "folder";
			} else if (frappe.utils.is_image_file(d.file_name)) {
				icon_class = "image";
				type = "image";
			} else {
				icon_class = "file";
				type = "file";
			}

			var title = d.file_name || d.file_url;
			title = title.slice(0, 60);
			d._title = title;
			d.icon_class = icon_class;
			d._type = type;

			d.subject_html = "\n\t\t\t" + (frappe.utils.icon(icon_class)) + "\n\t\t\t<span>" + title + "</span>\n\t\t\t" + (d.is_private ? '<i class="fa fa-lock fa-fw text-warning"></i>' : "") + "\n\t\t";
			return d;
		}

		before_render() {
			super.before_render();
			frappe.model.user_settings.save(
				"File",
				"grid_view",
				frappe.views.FileView.grid_view
			);
			this.save_view_user_settings({
				last_folder: this.current_folder
			});
		}

		render() {
			this.$result.empty().removeClass("file-grid-view");
			if (frappe.views.FileView.grid_view) {
				this.render_grid_view();
			} else {
				super.render();
				this.render_header();
			}
		}

		after_render() {}

		render_list() {
			if (frappe.views.FileView.grid_view) {
				this.render_grid_view();
			} else {
				super.render_list();
			}
		}

		render_grid_view() {
			var this$1 = this;

			var html = this.data
				.map(function (d) {
					var icon_class = d.icon_class + "-large";
					var file_body_html =
						d._type == "image"
							? ("<div class=\"file-image\"><img src=\"" + (d.file_url) + "\" alt=\"" + (d.file_name) + "\"></div>")
							: frappe.utils.icon(icon_class, {
								width: "40px",
								height: "45px"
							});
					var name = escape(d.name);
					var draggable = d.type == "Folder" ? false : true;
					return ("\n\t\t\t\t<a href=\"" + (this$1.get_route_url(d)) + "\"\n\t\t\t\t\tdraggable=\"" + draggable + "\" class=\"file-wrapper ellipsis\" data-name=\"" + name + "\">\n\t\t\t\t\t<div class=\"file-header\">\n\t\t\t\t\t\t<input class=\"level-item list-row-checkbox hidden-xs\" type=\"checkbox\" data-name=\"" + name + "\">\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"file-body\">\n\t\t\t\t\t\t" + file_body_html + "\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"file-footer\">\n\t\t\t\t\t\t<div class=\"file-title ellipsis\">" + (d._title) + "</div>\n\t\t\t\t\t\t<div class=\"file-creation\">" + (this$1.get_creation_date(d)) + "</div>\n\t\t\t\t\t</div>\n\t\t\t\t</a>\n\t\t\t");
				})
				.join("");

			this.$result.addClass("file-grid-view");
			this.$result.empty().html(
				("<div class=\"file-grid\">\n\t\t\t\t" + html + "\n\t\t\t</div>")
			);
		}

		get_breadcrumbs_html() {
			var route = frappe.router.parse();
			var folders = route.slice(2);

			return folders
				.map(function (folder, i) {
					if (i === folders.length - 1) {
						return ("<span>" + folder + "</span>");
					}
					var route = folders.reduce(function (acc, curr, j) {
						if (j <= i) {
							acc += "/" + curr;
						}
						return acc;
					}, "/app/file/view");

					return ("<a href=\"" + route + "\">" + folder + "</a>");
				})
				.join("&nbsp;/&nbsp;");
		}

		get_header_html() {
			var breadcrumbs_html = this.get_breadcrumbs_html();

			var header_selector_html = !frappe.views.FileView.grid_view
				? ("<input class=\"level-item list-check-all hidden-xs\" type=\"checkbox\" title=\"" + (__(
					"Select All"
				)) + "\">")
				: "";

			var header_columns_html = !frappe.views.FileView.grid_view
				? ("<div class=\"list-row-col ellipsis hidden-xs\">\n\t\t\t\t\t<span>" + (__("Size")) + "</span>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"list-row-col ellipsis hidden-xs\">\n\t\t\t\t\t<span>" + (__("Created")) + "</span>\n\t\t\t\t</div>")
				: "";

			var subject_html = "\n\t\t\t<div class=\"list-row-col list-subject level\">\n\t\t\t\t" + header_selector_html + "\n\t\t\t\t<span class=\"level-item\">" + breadcrumbs_html + "</span>\n\t\t\t</div>\n\t\t\t" + header_columns_html + "\n\t\t";

			return this.get_header_html_skeleton(
				subject_html,
				'<span class="list-count"></span>'
			);
		}

		get_route_url(file) {
			return file.is_folder
				? "/app/List/File/" + file.name
				: this.get_form_link(file);
		}

		get_creation_date(file) {
			var ref = file.creation.split(" ");
			var date = ref[0];
			var created_on;
			if (date === frappe.datetime.now_date()) {
				created_on = comment_when(file.creation);
			} else {
				created_on = frappe.datetime.str_to_user(date);
			}
			return created_on;
		}

		get_left_html(file) {
			file = this.prepare_datum(file);
			var file_size = file.file_size
				? frappe.form.formatters.FileSize(file.file_size)
				: "";
			var route_url = this.get_route_url(file);

			return ("\n\t\t\t<div class=\"list-row-col ellipsis list-subject level\">\n\t\t\t\t<span class=\"level-item file-select\">\n\t\t\t\t\t<input class=\"list-row-checkbox\"\n\t\t\t\t\t\ttype=\"checkbox\" data-name=\"" + (file.name) + "\">\n\t\t\t\t</span>\n\t\t\t\t<span class=\"level-item  ellipsis\" title=\"" + (file.file_name) + "\">\n\t\t\t\t\t<a class=\"ellipsis\" href=\"" + route_url + "\" title=\"" + (file.file_name) + "\">\n\t\t\t\t\t\t" + (file.subject_html) + "\n\t\t\t\t\t</a>\n\t\t\t\t</span>\n\t\t\t</div>\n\t\t\t<div class=\"list-row-col ellipsis hidden-xs text-muted\">\n\t\t\t\t<span>" + file_size + "</span>\n\t\t\t</div>\n\t\t\t<div class=\"list-row-col ellipsis hidden-xs text-muted\">\n\t\t\t\t<span>" + (this.get_creation_date(file)) + "</span>\n\t\t\t</div>\n\t\t");
		}

		get_right_html(file) {
			return ("\n\t\t\t<div class=\"level-item list-row-activity\">\n\t\t\t\t" + (comment_when(file.modified)) + "\n\t\t\t</div>\n\t\t");
		}

		setup_events() {
			super.setup_events();
			this.setup_drag_events();
		}

		setup_drag_events() {
			var this$1 = this;

			this.$result.on("dragstart", ".files .file-wrapper", function (e) {
				e.stopPropagation();
				e.originalEvent.dataTransfer.setData(
					"Text",
					$(e.currentTarget).attr("data-name")
				);
				e.target.style.opacity = "0.4";
				frappe.file_manager.cut(
					[{ name: $(e.currentTarget).attr("data-name") }],
					this$1.current_folder
				);
			});

			this.$result.on(
				"dragover",
				function (e) {
					e.preventDefault();
				},
				false
			);

			this.$result.on("dragend", ".files .file-wrapper", function (e) {
				e.preventDefault();
				e.stopPropagation();
				e.target.style.opacity = "1";
			});

			this.$result.on("drop", function (e) {
				e.stopPropagation();
				e.preventDefault();
				var $el = $(e.target).parents(".file-wrapper");

				var dataTransfer = e.originalEvent.dataTransfer;
				if (!dataTransfer) { return; }

				if (dataTransfer.files && dataTransfer.files.length > 0) {
					new frappe.ui.FileUploader({
						files: dataTransfer.files,
						folder: this$1.current_folder
					});
				} else if (dataTransfer.getData("Text")) {
					if ($el.parents(".folders").length !== 0) {
						var file_name = dataTransfer.getData("Text");
						var folder_name = decodeURIComponent(
							$el.attr("data-name")
						);
						frappe.file_manager.paste(folder_name);
						frappe.show_alert(
							("File " + file_name + " moved to " + folder_name)
						);
					}
				}
			});
		}

		toggle_result_area() {
			super.toggle_result_area();
			this.toggle_cut_paste_buttons();
		}

		on_row_checked() {
			super.on_row_checked();
			this.toggle_cut_paste_buttons();
		}

		toggle_cut_paste_buttons() {
			var hide_paste_btn =
				!frappe.file_manager.can_paste ||
				frappe.file_manager.old_folder === this.current_folder;
			var hide_cut_btn = !(this.$checks && this.$checks.length > 0);

			this.$paste_btn.toggle(!hide_paste_btn);
			this.$cut_button.toggle(!hide_cut_btn);
		}
	};

	frappe.views.FileView.grid_view =
		frappe.get_user_settings("File").grid_view || false;

	function redirect_to_home_if_invalid_route() {
		var route = frappe.get_route();
		if (route[2] === "List") {
			// if the user somehow redirects to List/File/List
			// redirect back to Home
			frappe.set_route("List", "File", "Home");
			return true;
		}
		return false;
	}

	// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt

	frappe.provide("frappe.treeview_settings");
	frappe.provide('frappe.views.trees');
	window.cur_tree = null;

	frappe.views.TreeFactory = class TreeFactory extends frappe.views.Factory {
		make(route) {
			frappe.model.with_doctype(route[1], function() {
				var options = {
					doctype: route[1],
					meta: frappe.get_meta(route[1])
				};

				if (!frappe.treeview_settings[route[1]] && !frappe.meta.get_docfield(route[1], "is_group")) {
					frappe.msgprint(__("Tree view is not available for {0}", [route[1]] ));
					return false;
				}
				$.extend(options, frappe.treeview_settings[route[1]] || {});
				frappe.views.trees[options.doctype] = new frappe.views.TreeView(options);
			});
		}

		on_show() {
			/**
			 * When the the treeview is visited using the previous button,
			 * the framework just show the treeview element that is hidden.
			 * Due to this, the data of the tree can be old.
			 * To deal with this, the tree will be refreshed whenever the
			 * treeview is visible.
			 */
			var route = frappe.get_route();
			var treeview = frappe.views.trees[route[1]];
			treeview && treeview.make_tree();
		}
	};

	frappe.views.TreeView = Class.extend({
		init: function(opts) {
			var me = this;

			this.opts = {};
			this.opts.get_tree_root = true;
			this.opts.show_expand_all = true;
			$.extend(this.opts, opts);
			this.doctype = opts.doctype;
			this.args = {doctype: me.doctype};
			this.page_name = frappe.get_route_str();
			this.get_tree_nodes =  me.opts.get_tree_nodes || "frappe.desk.treeview.get_children";

			this.get_permissions();
			this.make_page();
			this.make_filters();
			this.root_value = null;

			if (me.opts.get_tree_root) {
				this.get_root();
			}

			this.onload();
			this.set_menu_item();
			this.set_primary_action();
		},
		get_permissions: function(){
			this.can_read = frappe.model.can_read(this.doctype);
			this.can_create = frappe.boot.user.can_create.indexOf(this.doctype) !== -1 ||
						frappe.boot.user.in_create.indexOf(this.doctype) !== -1;
			this.can_write = frappe.model.can_write(this.doctype);
			this.can_delete = frappe.model.can_delete(this.doctype);
		},
		make_page: function() {
			var me = this;
			this.parent = frappe.container.add_page(this.page_name);
			frappe.ui.make_app_page({parent:this.parent, single_column:true});

			this.page = this.parent.page;
			frappe.container.change_to(this.page_name);
			frappe.breadcrumbs.add(me.opts.breadcrumb || locals.DocType[me.doctype].module, me.doctype);

			this.set_title();

			this.page.main.css({
				"min-height": "300px",
			});

			this.page.main.addClass('frappe-card');

			if(this.opts.show_expand_all) {
				this.page.add_inner_button(__('Expand All'), function() {
					me.tree.load_children(me.tree.root_node, true);
				});
			}

			if(this.opts.view_template) {
				var row = $('<div class="row"><div>').appendTo(this.page.main);
				this.body = $('<div class="col-sm-6 col-xs-12"></div>').appendTo(row);
				this.node_view = $('<div class="col-sm-6 hidden-xs"></div>').appendTo(row);
			} else {
				this.body = this.page.main;
			}
		},
		set_title: function() {
			this.page.set_title(this.opts.title || __('{0} Tree', [__(this.doctype)]));
		},
		onload: function() {
			var me = this;
			this.opts.onload && this.opts.onload(me);
		},
		make_filters: function() {
			var me = this;
			frappe.treeview_settings.filters = [];
			$.each(this.opts.filters || [], function(i, filter) {
				if (frappe.route_options && frappe.route_options[filter.fieldname]) {
					filter.default = frappe.route_options[filter.fieldname];
				}

				if (!filter.disable_onchange) {
					filter.change = function() {
						filter.onchange && filter.onchange();
						var val = this.get_value();
						me.args[filter.fieldname] = val;
						if (val) {
							me.root_label = val;
						} else {
							me.root_label = me.opts.root_label;
						}
						me.set_title();
						me.make_tree();
					};
				}

				me.page.add_field(filter);

				if (filter.default) {
					$("[data-fieldname='"+filter.fieldname+"']").trigger("change");
				}
			});
		},
		get_root: function() {
			var me = this;
			frappe.call({
				method: me.get_tree_nodes,
				args: me.args,
				callback: function(r) {
					if (r.message) {
						if (r.message.length > 1) {
							me.root_label = me.doctype;
							me.root_value = "";
						} else {
							me.root_label = r.message[0]["value"];
							me.root_value = me.root_label;
						}
						me.make_tree();
					}
				}
			});
		},
		make_tree: function() {
			var this$1 = this;

			$(this.parent).find(".tree").remove();

			var use_label = this.args[this.opts.root_label] || this.root_label || this.opts.root_label;
			var use_value = this.root_value;
			if (use_value == null) {
				use_value = use_label;
			}
			this.tree = new frappe.ui.Tree({
				parent: this.body,
				label: use_label,
				root_value: use_value,
				expandable: true,

				args: this.args,
				method: this.get_tree_nodes,

				// array of button props: {label, condition, click, btnClass}
				toolbar: this.get_toolbar(),

				get_label: this.opts.get_label,
				on_render: this.opts.onrender,
				on_get_node: this.opts.on_get_node,
				on_click: function (node) { this$1.select_node(node); },
			});

			cur_tree = this.tree;
			this.post_render();
		},

		rebuild_tree: function() {
			var me = this;

			frappe.call({
				"method": "frappe.utils.nestedset.rebuild_tree",
				"args": {
					'doctype': me.doctype,
					'parent_field': "parent_"+me.doctype.toLowerCase().replace(/ /g, '_'),
				},
				"callback": function(r) {
					if (!r.exc) {
						me.make_tree();
					}
				}
			});
		},

		post_render: function() {
			var me = this;
			me.opts.post_render && me.opts.post_render(me);
		},

		select_node: function(node) {
			var me = this;
			if(this.opts.click) {
				this.opts.click(node);
			}
			if(this.opts.view_template) {
				this.node_view.empty();
				$(frappe.render_template(me.opts.view_template,
					{data:node.data, doctype:me.doctype})).appendTo(this.node_view);
			}
		},
		get_toolbar: function() {
			var me = this;

			var toolbar = [
				{
					label:__(me.can_write? "Edit": "Details"),
					condition: function(node) {
						return !node.is_root && me.can_read;
					},
					click: function(node) {
						frappe.set_route("Form", me.doctype, node.label);
					}
				},
				{
					label:__("Add Child"),
					condition: function(node) {
						return me.can_create && node.expandable && !node.hide_add;
					},
					click: function(node) {
						me.new_node();
					},
					btnClass: "hidden-xs"
				},
				{
					label:__("Rename"),
					condition: function(node) {
						var allow_rename = true;
						if (me.doctype && frappe.get_meta(me.doctype)) {
							if(!frappe.get_meta(me.doctype).allow_rename) { allow_rename = false; }
						}
						return !node.is_root && me.can_write && allow_rename;
					},
					click: function(node) {
						frappe.model.rename_doc(me.doctype, node.label, function(new_name) {
							node.$tree_link.find('a').text(new_name);
							node.label = new_name;
							me.tree.refresh();
						});
					},
					btnClass: "hidden-xs"
				},
				{
					label:__("Delete"),
					condition: function(node) { return !node.is_root && me.can_delete; },
					click: function(node) {
						frappe.model.delete_doc(me.doctype, node.label, function() {
							node.parent.remove();
						});
					},
					btnClass: "hidden-xs"
				}
			];

			if(this.opts.toolbar && this.opts.extend_toolbar) {
				toolbar = toolbar.filter(function (btn) {
					return !me.opts.toolbar.find(function (d) { return d["label"]==btn["label"]; });
				});
				return toolbar.concat(this.opts.toolbar)
			} else if (this.opts.toolbar && !this.opts.extend_toolbar) {
				return this.opts.toolbar
			} else {
				return toolbar
			}
		},
		new_node: function() {
			var me = this;
			var node = me.tree.get_selected_node();

			if(!(node && node.expandable)) {
				frappe.msgprint(__("Select a group node first."));
				return;
			}

			this.prepare_fields();

			// the dialog
			var d = new frappe.ui.Dialog({
				title: __('New {0}',[__(me.doctype)]),
				fields: me.fields
			});

			var args = $.extend({}, me.args);
			args["parent_"+me.doctype.toLowerCase().replace(/ /g,'_')] = me.args["parent"];

			d.set_value("is_group", 0);
			d.set_values(args);

			// create
			d.set_primary_action(__("Create New"), function() {
				var v = d.get_values();
				if(!v) { return; }

				v.parent = node.label;
				v.doctype = me.doctype;

				if(node.is_root){
					v['is_root'] = node.is_root;
				}
				else{
					v['is_root'] = false;
				}

				d.hide();
				frappe.dom.freeze(__('Creating {0}', [me.doctype]));

				$.extend(args, v);
				return frappe.call({
					method: me.opts.add_tree_node || "frappe.desk.treeview.add_node",
					args: args,
					callback: function(r) {
						if(!r.exc) {
							me.tree.load_children(node);
						}
					},
					always: function() {
						frappe.dom.unfreeze();
					},
				});
			});
			d.show();
		},
		prepare_fields: function(){
			var me = this;

			this.fields = [
				{fieldtype:'Check', fieldname:'is_group', label:__('Group Node'),
					description: __("Further nodes can be only created under 'Group' type nodes")}
			];

			if (this.opts.fields) {
				this.fields = this.opts.fields;
			}

			this.ignore_fields = this.opts.ignore_fields || [];

			var mandatory_fields = $.map(me.opts.meta.fields, function(d) {
				return (d.reqd || d.bold && !d.read_only) ? d : null });

			var opts_field_names = this.fields.map(function(d) {
				return d.fieldname
			});

			mandatory_fields.map(function(d) {
				if($.inArray(d.fieldname, me.ignore_fields) === -1 && $.inArray(d.fieldname, opts_field_names) === -1) {
					me.fields.push(d);
				}
			});
		},
		print_tree: function() {
			if(!frappe.model.can_print(this.doctype)) {
				frappe.msgprint(__("You are not allowed to print this report"));
				return false;
			}
			var tree = $(".tree:visible").html();
			var me = this;
			frappe.ui.get_print_settings(false, function(print_settings) {
				var title =  __(me.docname || me.doctype);
				frappe.render_tree({title: title, tree: tree, print_settings:print_settings});
				frappe.call({
					method: "frappe.core.doctype.access_log.access_log.make_access_log",
					args: {
						doctype: me.doctype,
						report_name: me.page_name,
						page: tree,
						method: 'Print'
					}
				});
			});
		},
		set_primary_action: function() {
			var me = this;
			if (!this.opts.disable_add_node && this.can_create) {
				me.page.set_primary_action(__("New"), function() {
					me.new_node();
				}, "add");
			}
		},
		set_menu_item: function() {
			var me = this;

			this.menu_items = [
				{
					label: __('View List'),
					action: function() {
						frappe.set_route('List', me.doctype);
					}
				},
				{
					label: __('Print'),
					action: function() {
						me.print_tree();
					}

				},
				{
					label: __('Refresh'),
					action: function() {
						me.make_tree();
					}
				} ];

			if (frappe.user.has_role('System Manager') &&
				frappe.meta.has_field(me.doctype, "lft") &&
				frappe.meta.has_field(me.doctype, "rgt")) {
				this.menu_items.push(
					{
						label: __('Rebuild Tree'),
						action: function() {
							me.rebuild_tree();
						}
					}
				);
			}

			if (me.opts.menu_items) {
				me.menu_items.push.apply(me.menu_items, me.opts.menu_items);
			}

			$.each(me.menu_items, function(i, menu_item){
				var has_perm = true;
				if(menu_item["condition"]) {
					has_perm = eval(menu_item["condition"]);
				}

				if (has_perm) {
					me.page.add_menu_item(menu_item["label"], menu_item["action"]);
				}
			});
		}
	});

	// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
	// MIT License. See license.txt
	frappe.provide('frappe.views');
	frappe.provide("frappe.interaction_settings");

	frappe.views.InteractionComposer = class InteractionComposer {
		constructor(opts) {
			$.extend(this, opts);
			this.make();
		}

		make() {
			var me = this;
			me.dialog = new frappe.ui.Dialog({
				title: (me.title || me.subject || __("New Activity")),
				no_submit_on_enter: true,
				fields: me.get_fields(),
				primary_action_label: __('Create'),
				primary_action: function() {
					me.create_action();
				}
			});

			$(document).on("upload_complete", function(event, attachment) {
				if(me.dialog.display) {
					var wrapper = $(me.dialog.fields_dict.select_attachments.wrapper);

					// find already checked items
					var checked_items = wrapper.find('[data-file-name]:checked').map(function() {
						return $(this).attr("data-file-name");
					});

					// reset attachment list
					me.render_attach();

					// check latest added
					checked_items.push(attachment.name);

					$.each(checked_items, function(i, filename) {
						wrapper.find('[data-file-name="'+ filename +'"]').prop("checked", true);
					});
				}
			});
			me.prepare();
			me.dialog.show();
		}

		get_fields() {
			var me = this;
			var interaction_docs = Object.keys(get_doc_mappings());

			var fields = [
				{label:__("Reference"), fieldtype:"Select",
					fieldname:"interaction_type", options: interaction_docs,
					reqd: 1,
					onchange: function () {
						var values = me.get_values();
						me.get_fields().forEach(function (field) {
							if (field.fieldname != "interaction_type") {
								me.dialog.set_df_property(field.fieldname, "reqd", 0);
								me.dialog.set_df_property(field.fieldname, "hidden", 0);
							}
						});
						me.set_reqd_hidden_fields(values);
						me.get_event_categories();
					}
				},
				{label:__("Category"), fieldtype:"Select",
					fieldname:"category", options: "", hidden: 1},
				{label:__("Public"), fieldtype:"Check",
					fieldname:"public", default: "1"},
				{fieldtype: "Column Break"},
				{label:__("Date"), fieldtype:"Datetime",
					fieldname:"due_date"},
				{label:__("Assigned To"), fieldtype:"Link",
					fieldname:"assigned_to", options:"User"},
				{fieldtype: "Section Break"},
				{label:__("Summary"), fieldtype:"Data",
					fieldname:"summary"},
				{fieldtype: "Section Break"},
				{fieldtype:"Text Editor", fieldname:"description"},
				{fieldtype: "Section Break"},
				{label:__("Select Attachments"), fieldtype:"HTML",
					fieldname:"select_attachments"}
			];

			return fields;

		}

		get_event_categories() {
			var me = this;
			frappe.model.with_doctype('Event', function () {
				var categories = frappe.meta.get_docfield("Event", "event_category").options.split("\n");
				me.dialog.get_input("category").empty().add_options(categories);
			});
		}

		prepare() {
			this.setup_attach();
		}

		set_reqd_hidden_fields(values) {
			var me = this;
			if (values&&"interaction_type" in values) {
				var doc_mapping = get_doc_mappings();
				doc_mapping[values.interaction_type]["reqd_fields"].forEach(function (value) {
					me.dialog.set_df_property(value, 'reqd', 1);
				});

				doc_mapping[values.interaction_type]["hidden_fields"].forEach(function (value) {
					me.dialog.set_df_property(value, 'hidden', 1);
				});
			}
		}

		setup_attach() {
			var this$1 = this;

			var fields = this.dialog.fields_dict;
			var attach = $(fields.select_attachments.wrapper);

			if (!this.attachments) {
				this.attachments = [];
			}

			var args = {
				folder: 'Home/Attachments',
				on_success: function (attachment) { return this$1.attachments.push(attachment); }
			};

			if (this.frm) {
				args = {
					doctype: this.frm.doctype,
					docname: this.frm.docname,
					folder: 'Home/Attachments',
					on_success: function (attachment) {
						this$1.frm.attachments.attachment_uploaded(attachment);
						this$1.render_attach();
					}
				};
			}

			$("<h6 class='text-muted add-attachment' style='margin-top: 12px; cursor:pointer;'>"
				+__("Select Attachments")+"</h6><div class='attach-list'></div>\
			<p class='add-more-attachments'>\
			<a class='text-muted small'><i class='octicon octicon-plus' style='font-size: 12px'></i> "
				+__("Add Attachment")+"</a></p>").appendTo(attach.empty());
			attach
				.find(".add-more-attachments a")
				.on('click',function () { return new frappe.ui.FileUploader(args); });
			this.render_attach();
		}

		render_attach(){
			var fields = this.dialog.fields_dict;
			var attach = $(fields.select_attachments.wrapper).find(".attach-list").empty();

			var files = [];
			if (this.attachments && this.attachments.length) {
				files = files.concat(this.attachments);
			}
			if (cur_frm) {
				files = files.concat(cur_frm.get_files());
			}

			if(files.length) {
				$.each(files, function(i, f) {
					if (!f.file_name) { return; }
					f.file_url = frappe.urllib.get_full_url(f.file_url);

					$(repl('<p class="checkbox">'
						+	'<label><span><input type="checkbox" data-file-name="%(name)s"></input></span>'
						+		'<span class="small">%(file_name)s</span>'
						+	' <a href="%(file_url)s" target="_blank" class="text-muted small">'
						+		'<i class="fa fa-share" style="vertical-align: middle; margin-left: 3px;"></i>'
						+ '</label></p>', f))
						.appendTo(attach);
				});
			}
		}

		create_action() {
			var me = this;
			var btn = me.dialog.get_primary_btn();

			var form_values = this.get_values();
			if(!form_values) { return; }

			var selected_attachments =
				$.map($(me.dialog.wrapper).find("[data-file-name]:checked"), function(element){
					return $(element).attr("data-file-name");
				});

			me.create_interaction(btn, form_values, selected_attachments);
		}

		get_values() {
			var me = this;
			var values = this.dialog.get_values(true);
			if (values) {
				values["reference_doctype"] = me.frm.doc.doctype;
				values["reference_document"] = me.frm.doc.name;
			}

			return values;
		}

		create_interaction(btn, form_values, selected_attachments) {
			var me = this;
			me.dialog.hide();

			var field_map = get_doc_mappings();
			var interaction_values = {};
			Object.keys(form_values).forEach(function (value) {
				interaction_values[field_map[form_values.interaction_type]["field_map"][value]] = form_values[value];
			});

			if ("event_type" in interaction_values){
				interaction_values["event_type"] = (form_values.public == 1) ? "Public" : "Private";
			}
			if (interaction_values["doctype"] == "Event") {
				interaction_values["event_participants"] = [{"reference_doctype": form_values.reference_doctype,
					"reference_docname": form_values.reference_document}];
			}
			if (!("owner" in interaction_values)){
				interaction_values["owner"] = frappe.session.user;
			}
			if (!("assigned_by" in interaction_values) && interaction_values["doctype"] == "ToDo") {
				interaction_values["assigned_by"] = frappe.session.user;
			}
			return frappe.call({
				method:"frappe.client.insert",
				args: { doc: interaction_values},
				btn: btn,
				callback: function(r) {
					if(!r.exc) {
						frappe.show_alert({
							message: __("{0} created successfully", [form_values.interaction_type]),
							indicator: 'green'
						});
						if ("assigned_to" in form_values) {
							me.assign_document(r.message, form_values["assigned_to"]);
						}

						if (selected_attachments) {
							me.add_attachments(r.message, selected_attachments);
						}
						if (cur_frm) {
							cur_frm.reload_doc();
						}
					} else {
						frappe.msgprint(__("There were errors while creating the document. Please try again."));
					}
				}
			});

		}

		assign_document(doc, assignee) {
			if (doc.doctype != "ToDo") {
				frappe.call({
					method:'frappe.desk.form.assign_to.add',
					args: {
						doctype: doc.doctype,
						name: doc.name,
						assign_to: JSON.stringify([assignee]),
					},
					callback:function(r) {
						if(!r.exc) {
							frappe.show_alert({
								message: __("The document has been assigned to {0}", [assignee]),
								indicator: 'green'
							});
							return;
						} else {
							frappe.show_alert({
								message: __("The document could not be correctly assigned"),
								indicator: 'orange'
							});
							return;
						}
					}
				});
			}

		}

		add_attachments(doc, attachments) {
			frappe.call({
				method:'frappe.utils.file_manager.add_attachments',
				args: {
					doctype: doc.doctype,
					name: doc.name,
					attachments: JSON.stringify(attachments)
				},
				callback:function(r) {
					if(!r.exc) {
						return;
					} else {
						frappe.show_alert({
							message: __("The attachments could not be correctly linked to the new document"),
							indicator: 'orange'
						});
						return;
					}
				}
			});

		}
	};

	function get_doc_mappings() {
		var doc_map = {
			"Event": {
				"field_map": {
					"interaction_type": "doctype",
					"summary": "subject",
					"description": "description",
					"category": "event_category",
					"due_date": "starts_on",
					"public": "event_type"
				},
				"reqd_fields": ["summary", "due_date"],
				"hidden_fields": []
			} ,
			"ToDo": {
				"field_map": {
					"interaction_type": "doctype",
					"description": "description",
					"due_date": "date",
					"reference_doctype": "reference_type",
					"reference_document": "reference_name",
					"assigned_to": "owner"
				},
				"reqd_fields": ["description"],
				"hidden_fields": ["public", "category"]
			}
		};

		return doc_map;
	}

	frappe.templates['image_view_item_row'] = '<div class="image-view-item has-checkbox ellipsis">  <div class="image-view-header doclist-row">   <div class="list-value">   {{ subject }}   </div>  </div>    <div class="image-view-body">   <a  data-name="{{ data.name }}"    title="{{ data.name }}"    href="/app/Form/{{ data.doctype }}/{{ data.name }}"   >    <div class="image-field"     data-name="{{ data.name }}"     style="     {% if (!data._image_url) { %}      background-color: {{ color }};     {% } %}     border: 0px;"    >     {% if (!data._image_url) { %}     <span class="placeholder-text">      {%= frappe.get_abbr(data._title) %}     </span>     {% } %}     {% if (data._image_url) { %}     <img data-name="{{ data.name }}" src="{{ data._image_url }}" alt="{{data.title}}">     {% } %}     <button class="btn btn-default zoom-view" data-name="{{data.name}}">      <i class="fa fa-search-plus"></i>     </button>    </div>   </a>  </div> </div> ';

	frappe.templates['photoswipe_dom'] = '    <div class="pswp" tabindex="-1" role="dialog" aria-hidden="true">     <div class="pswp__bg"></div>     <div class="pswp__scroll-wrap">       <div class="pswp__container">    <div class="pswp__item"></div>    <div class="pswp__item"></div>    <div class="pswp__item"></div>   </div>    <div class="pswp__more-items">    </div>       <div class="pswp__ui pswp__ui--hidden">     <div class="pswp__top-bar">            <div class="pswp__counter"></div>      <button class="pswp__button pswp__button--close" title="Close (Esc)"></button>      <button class="pswp__button pswp__button--share" title="Share"></button>      <button class="pswp__button pswp__button--fs" title="Toggle fullscreen"></button>      <button class="pswp__button pswp__button--zoom" title="Zoom in/out"></button>                <div class="pswp__preloader">      <div class="pswp__preloader__icn">        <div class="pswp__preloader__cut">       <div class="pswp__preloader__donut"></div>        </div>      </div>     </div>    </div>     <div class="pswp__share-modal pswp__share-modal--hidden pswp__single-tap">     <div class="pswp__share-tooltip"></div>    </div>     <button class="pswp__button pswp__button--arrow--left" title="Previous (arrow left)">    </button>     <button class="pswp__button pswp__button--arrow--right" title="Next (arrow right)">    </button>     <div class="pswp__caption">     <div class="pswp__caption__center"></div>    </div>    </div>   </div>  </div>';

	frappe.templates['kanban_board'] = '<div class="kanban">  <div class="kanban-column add-new-column">   <div class="kanban-column-title compose-column">    <a> + {{ __("Add Column") }}</a>   </div>   <form class="compose-column-form kanban-column-title">    <input class="new-column-title" name="title" type="text" autocomplete="off">   </form>  </div>  <div class="kanban-empty-state text-muted text-center" style="display: none;">   {{ __("Loading...") }}  </div> </div>';

	frappe.templates['kanban_column'] = '<div class="kanban-column" data-column-value="{{title}}">  <div class="kanban-column-header">   <span class="kanban-column-title">    <span class="indicator-pill {{indicator}}"></span>    <span class="kanban-title ellipsis" title="{{title}}">{{ __(title) }}</span>   </span>   <div class="column-options dropdown pull-right">    <a data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">     <svg class="icon icon-sm">      <use href="#icon-dot-horizontal"></use>     </svg>    </a>    <ul class="dropdown-menu" style="max-height: 300px; overflow-y: auto;">     <li><a class="dropdown-item" data-action="archive">{{ __("Archive") }}</a></li>    </ul>   </div>  </div>  <div class="add-card">   <div class="ellipsis">    + {{ __("Add {0}", [__(doctype)]) }}   </div>  </div>  <div class="kanban-card new-card-area">   <textarea name="title"></textarea>  </div>  <div class="kanban-cards">  </div> </div>';

	frappe.templates['kanban_card'] = '<div class="kanban-card-wrapper {{ disable_click }}" data-name="{{escape(name)}}">  <div class="kanban-card content">   {% if(image_url) { %}   <div class="kanban-image">    <img  src="{{image_url}}" alt="{{title}}">   </div>   {% } %}   <div class="kanban-card-body">    <div class="kanban-title-area">     <a href="{{ form_link }}">      <div class="kanban-card-title ellipsis" title="{{title}}">       {{ title }}      </div>     </a>     <br>     <div class="kanban-card-doc text-muted">      {{ doc_content }}     </div>    </div>    <div class="kanban-card-meta">    </div>   </div>  </div> </div> ';

}());
//# sourceMappingURL=list.min.js.map
