"use strict"

import m from "mithril";

/**
 * A class that manages a form for Mithril.
 *
 * This allows you to build a form once and let it handle itself with redraws as
 * the user interacts with it. First set up the form just once, then use the m()
 * functionto draw the form with Mithril. If the form is to be handled entirely
 * on the client-side or submitted via AJAX use the getValues() function to get
 * the values of every form element.
 *
 * To set up the form use the add*() functions. The `name` parameter is used for
 * the field's id and the key for the form values. The `display_name` is used
 * for the field's label. The `initial`* parameter sets the initial state of the
 * form field. The `extra_function` will be called each time the form is drawn,
 * the result will be placed after the field and its label. The fields are drawn
 * in a list in the order they are added.
 *
 * The `base_id` is used as the id for the form. For each of the fields the id
 * is created from the `base_id` as a prefix to the field's `name`.
 *
 * *Note:* You can use the result of Mithril's m() function for the `display`
 * value. Remember, though, that this will only be called once and this should
 * not rely on any input values.
 */
class Form
{
    /**
     * Create a new form.
     *
     * @param {string} base_id  The id of the form. This is also used as the
     *                          prefix to the id's of the fields.
     */
    constructor(base_id="m_form")
    {
        this._base_id = base_id;
        this._fields  = [];
        this._values  = {};
        this._readers = {};
        this._submit  = null;
    }

    /**
     * Get the values of all of the form's fields' values.
     *
     * @returns {Object}
     *     The names of the fields are the keys and the field's values are the
     *     values.
     */
    getValues()
    {
        return {...this._values};
    }

    /**
     * Add a regular `<input>` field.
     *
     * Generally the `type` parameter will accept any value the `<input>`
     * element will. The exceptions are "checkbox", use the addCheckbox()
     * function, and "submit", use the setSubmit() function. If the type is
     * "number" the value will be handled via parseInt(). In addition there is
     * the special type "list", this renders with a type of "text" but the value
     * is separated into an Array and concantenated into a comma-seaprated list
     * when displayed.
     *
     * @param {string}   name            The name and if of this field.
     * @param {string}   display_name    The name to display in the `<label>`
     *                                   for the user.
     * @param {string}   initial_value   The value the field should have when
     *                                   the form is first drawn.
     * @param {string}   type            The type of the `<input>`, this is used
     *                                   as the value for the element.
     * @param {function} extra_function  A function that will be called every
     *                                   time the filed is drawn. The result of
     *                                   this function will be placed after the
     *                                   field and its label.
     */
    addInput(name, display_name, initial_value="", type="text", extra_function=null)
    {
        this._values[name] = initial_value;

        let value_function   = null;
        let field_function   = null;
        let handler_function = null;


        if ("number" == type)
        {
            handler_function = (event) => {
                const new_value = parseInt(event.target.value, 10);
                if (!isNaN(new_value))
                {
                    this._values[name] = new_value;
                }
            };
        }
        else if ("list" == type)
        {
            type = "text";

            value_function   = function formatListValue(raw_value)
            {
                return raw_value.join(", ");
            };

            handler_function = (event) => {
                this._values[name] = event.target.value.split(/[^-.a-zA-Z0-9]+/);
            };
        }
        else
        {
            handler_function = (event) => {
                this._values[name] = event.target.value;
            };
        }

        field_function = function makeInputField(value, id)
        {
            return m("input",
                     {id:       id,
                      type:     type,
                      value:    value,
                      onchange: handler_function});
        }

        let field_spec = {display_name: display_name,
                          name:         name,
                          field:        field_function};
        if (value_function)
        {
            field_spec.value = value_function;
        }
        if (extra_function)
        {
            field_spec.extra = extra_function;
        }

        this._fields.push(field_spec);
    }

    /**
     * Add an `<input type="checkbox">` field.
     *
     * @param {string}   name               The name and if of this field.
     * @param {string}   display_name       The name to display in the `<label>`
     *                                      for the user.
     * @param {bool}     initially_checked  Whether or not the checkbox should
     *                                      be checked when the form is first
     *                                      drawn.
     * @param {function} extra_function     A function that will be called every
     *                                      time the field is drawn. The result
     *                                      of this function will be placed
     *                                      after the field and its label.
     */
    addCheckbox(name, display_name, initially_checked, extra_function=null)
    {
        this._values[name] = initially_checked;

        const handler_function = (event) => {
            this._values[name] = event.target.checked;
        }

        const  field_function = function makeCheckbox(value, id)
        {
            return m("input",
                     {id:       id,
                      type:     "checkbox",
                      checked:  value,
                      onchange: handler_function});
        }

        let field_spec = {display_name: display_name,
                          name:         name,
                          field:        field_function,
                          reverse:      true};
        if (extra_function)
        {
            field_spec.extra = extra_function;
        }

        this._fields.push(field_spec);
    }

    /**
     * Add a `<select>` field and its `<option>` elements.
     *
     * The `options` can be, in their simplest, an Array of items that
     * implicitly convert to strings. In this case the the value and the
     * displayed name of the option will be the same. Alternatively, each item
     * can be an Object with keys 'name' and 'value'. The 'name' is used as the
     * display name and the 'value' as the value. Lastly an Object with keys
     * 'group' and 'options' will create an option group with the display name
     * of the 'group' value and the 'options' containing the groups options.
     *
     * # Example Options:
     * - Simple Array
     *   ```.js
     *   ["red", "green", "blue"]
     *   ```
     *   yields:
     *   ```.html
     *   <option value="red">red</option>
     *   <option value="green">green</option>
     *   <option value="blue">blue</option>
     *   ```
     * - Array of Objects
     *   ```.js
     *   [{name: "one",   value: 1},
     *    {name: "two",   value: 2},
     *    {name: "three", value: 3}]
     *   ```
     *   yields:
     *   ```.html
     *   <option value="1">one</option>
     *   <option value="2">two</option>
     *   <option value="3">three</option>
     *   ```
     * - Option Groups
     *   ```.js
     *   [{group:   "Pie",
     *     options: [{name: "Apple",          value: "Apple"},
     *               {name: "Pumpkin",        value: "Pumpkin"},
     *               {name: "Lemon Meringue", value: "LemonMeringue"}]},
     *    {group: "Ice Cream",
     *     options: ["Vanilla", "Chocolate", "Strawberry" ]}]
     *   ```
     *   yields:
     *   ```.html
     *   <optgroup label="Pie">
     *     <option value="Apple">Apple</option>
     *     <option value="Pumpkin">Pumpkin</option>
     *     <option value="LemonMeringue">Lemon Meringue</option>
     *   </optgroup>
     *   <optgroup label="Ice Cream">
     *     <option value="Vanilla">Vanilla</option>
     *     <option value="Chocolate">Chocolate</option>
     *     <option value="Strawberry">Strawberry</option>
     *   </optgroup>
     *   ```
     *
     * @param {string}   name            The name and if of this field.
     * @param {string}   display_name    The name to display in the `<label>`
     *                                   for the user.
     * @param {string}   initial_value   The value the field should have when
     *                                   the form is first drawn.
     * @param {Array}    options         The options to list in the `<select>`
     *                                   element.
     * @param {function} extra_function  A function that will be called every
     *                                   time the field is drawn. The result of
     *                                   this function will be placed after the
     *                                   field and its label.
     */
    addSelect(name, display_name, initial_value, options, extra_function=null)
    {
        this._values[name] = initial_value;

        const handler_function = (event) => {
            this._values[name] = event.target.value;
        };

        const field_function = function makeSelectField(value, id)
        {
            return m("select",
                     {id:       id,
                      value:    value,
                      onchange: handler_function},
                     Form._makeOptions(options));
        }

        let field_spec = {display_name: display_name,
                          name:         name,
                          field:        field_function};
        if (extra_function)
        {
            field_spec.extra = extra_function;
        }

        this._fields.push(field_spec);
    }

    addTextArea(name, display_name, rows, columns, extra_function=null)
    {
        this._values[name] = null;

        const handler_function = (event) => {
            this._values[name] = event.target.value;
        };

        const field_function = function makeTextArea(value, id)
        {
            return m("textarea",
                     {
                         id:       id,
                         onchange: handler_function,
                         rows:     rows,
                         cols:     columns
                     },
                     value);
        }

        let field_spec = {display_name: display_name,
                          name:         name,
                          field:        field_function};
        if (extra_function)
        {
            field_spec.extra = extra_function;
        }

        this._fields.push(field_spec);
    }

    addTextFile(name, display_name, extra_function=null)
    {
        this._values[name]  = null;
        this._readers[name] = null;

        const handler_function = (event) => {
            const files = event.target.files;
            if (1 == files.length)
            {
                if (this._readers[name])
                {
                    this._readers[name].abort();
                }

                let reader = new FileReader();
                reader.readAsText(files[0]);
                reader.onload = (event) => {
                    this._values[name] = {name: files[0].name,
                                          text: event.target.result};
                };
                this._readers[name] = reader;
            }
            else
            {
                this._values[name] = null;
            }
        };

        const field_function = function makeFileField(value, id)
        {
            return m("input", {id: id,
                               type: "file",
                               onchange: handler_function});
        }

        let field_spec = {display_name: display_name,
                          name:         name,
                          field:        field_function};
        if (extra_function)
        {
            field_spec.extra = extra_function;
        }

        this._fields.push(field_spec);
    }

    /**
     * Set up the submit button.
     *
     * *Note:* If this is called multiple times only the last call will have an
     * effect. The form can only have one submit button.
     *
     * @param {string}   display_name      The name to display in the button.
     * @param {function} handler_function  A function to be called when the
     *                                     button is clicked.
     */
    setSubmit(display_name, handler_function)
    {
        this._submit = () => {
            return m("input", {type:    "submit",
                               value:   display_name,
                               onclick: handler_function});
        };
    }

    /**
     * Reander the form for Mithril.
     *
     * This function renders the current version of the form for display via
     * Mithril. This should be called from your component's view() function.
     *
     * @returns {Vnode}  A Mithril Vnode that represents this form.
     *
     * @see https://mithril.js.org/hyperscript.html
     */
    m()
    {
        const fields = this._fields.map((field_spec) => {
            const id = `${this._base_id}_${field_spec.name}`;

            let value = this._values[field_spec.name];
            if (field_spec.value)
            {
                value = field_spec.value(value);
            }

            let item_class  = null;
            let field_parts = [ m("label",
                                  {class: "field_name", for: id},
                                  field_spec.display_name),
                                field_spec.field(value, id)];
            if (field_spec.reverse)
            {
                item_class = "reversed";
                field_parts.reverse();
            }
            if (field_spec.extra)
            {
                field_parts.push(field_spec.extra());
            }

            return m("li", {class: item_class}, field_parts);
        });

        let submit = null;
        if (this._submit)
        {
            submit = this._submit();
        }

        return m("form", {id: this._base_id, action: "#", onsubmit: () => { return false; }},
                 m("ul", fields),
                submit);
    }

    /**
     * A helper function for rendering options for `<select>` elements.
     *
     * **Warning:** To handle `<optgroup>` elements this function is recursive and
     * does not protect against cycles in `options`.
     *
     * @private
     */
    static _makeOptions(options)
    {
        return options.map((option) => {
            if (option.group && option.options)
            {
                return m("optgroup",
                         {label: option.group},
                         this._makeOptions(option.options));
            }
            else if(option.value && option.name)
            {
                return m("option", {value: option.value}, option.name);
            }
            else
            {
                return m("option", {value: option}, option);
            }
        });
    }
};

export default Form;
