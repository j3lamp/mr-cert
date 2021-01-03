"use strict"

import Enum from "es6-enum";
import m    from "mithril";

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
     * @typedef {Object} Form~ExtraFunctions
     *
     * An object containing one or more extra functions that will be used to
     * customize a form field.
     *
     * @property {Form~RenderSuffix} render_suffix
     *     A function that provides content to be rendered after the form field.
     *     It should have a signature like () -> {Vnode}.
     */

    /**
     * A function that will be called after rendering the form field. This can
     * be used to display extra information after the field.
     * @callback Form~RenderSuffix
     *
     * @returns {Vnode}  The Mithril Vnode to be displayed.
     */

    /**
     * Render an actual form field. This should not worry about rendering all
     * the extra stuff such as labels, etc.
     * @callback Form~_FieldFunction
     *
     * @param {string} value
     *     The current value of the form field.
     * @param {string} id
     *     The id of the form field.
     *
     * @returns {Vnode}  A Mithril Vnode that represents this form field.
     *
     * @private
     */

    /**
     * Transform the stored value for display by the form field. This is useful
     * if the value is not stored internally as a string.
     * @callback Form~_ValueFunction
     *
     * @param {*} value
     *     The value to be transformed.
     *
     * @returns {string}  The value transformed for use by the form field.
     *
     * @private
     */

    /**
     * A value that indicates a form field should be cleared on the next
     * re-draw.
     *
     * This is useful for filed whose value is tracked, but not set, such as
     * file fields.
     *
     * @private
     */
    static _clear = Symbol();


    /**
     * An enumeration that describes the oder in which a field should be drawn.
     *
     * | Value      | Description                                                         |
     * | ---------- | ------------------------------------------------------------------- |
     * | `NORMAL`   | Display a form field in the "normal" oder: label followed by field. |
     * | `REVERSED` | Display a form field in reversed order: field followed by label.    |
     *
     * @private
     */
    static _FieldOrder = Enum("NORMAL", "REVERSED");

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
        let values = {...this._values};

        for (const key in values)
        {
            if (Form._clear === values[key])
            {
                values[key] = "";
            }
        }

        return values;
    }

    /**
     * Add a regular `<input>` field.
     *
     * Generally the `type` parameter will accept any value the `<input>`
     * element will. The exceptions are "checkbox", use the
     * {@link Form#addCheckbox addCheckbox()} function; "file", use the
     * {@link Form#addTextFile addTextFile()} function; and "submit", use the
     * {@link Form#setSubmit setSubmit()} function. If the type is "number" the
     * value will be handled via parseInt(). In addition there is the special
     * type "list", this renders with a type of "text" but the value is
     * separated into an Array and concantenated into a comma-seaprated list
     * when displayed.
     *
     * @param {string} name
     *     The name and id of this field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {string} initial_value
     *     The value the field should have when the form is first drawn.
     * @param {string} type
     *     The type of the `<input>`, this is used as the value for the element.
     * @param {Form~ExtraFunctions} extra_functions
     *     Functions that can be used to modify the display or behavior of the
     *     form field.
     */
    addInput(name, display_name, initial_value="", type="text", extra_functions={})
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

        this._pushField(name,
                        display_name,
                        field_function,
                        Form._FieldOrder.NORMAL,
                        value_function,
                        extra_functions);
    }

    /**
     * Add an `<input type="checkbox">` field.
     *
     * @param {string} name
     *     The name and id of this field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {bool} initially_checked
     *     Whether or not the checkbox should be checked when the form is first
     *     drawn.
     * @param {Form~ExtraFunctions} extra_functions
     *     Functions that can be used to modify the display or behavior of the
     *     form field.
     */
    addCheckbox(name, display_name, initially_checked, extra_functions={})
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

        this._pushField(name,
                        display_name,
                        field_function,
                        Form._FieldOrder.REVERSED,
                        null,
                        extra_functions);
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
     * @param {string} name
     *     The name and id of this field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {string} initial_value
     *     The value the field should have when the form is first drawn.
     * @param {Array} options
     *     The options to list in the `<select>` element.
     * @param {Form~ExtraFunctions} extra_functions
     *     Functions that can be used to modify the display or behavior of the
     *     form field.
     */
    addSelect(name, display_name, initial_value, options, extra_functions={})
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

        this._pushField(name,
                        display_name,
                        field_function,
                        Form._FieldOrder.NORMAL,
                        null,
                        extra_functions);
    }

    /**
     * Add a `<textarea>` field.
     *
     * @param {string} name
     *     The name and id of this field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {string} initial_value
     *     The value the field should have when the form is first drawn.
     * @param {number} rows
     *     How tall the text box should be in lines of text.
     * @param {number} columns
     *     How wide the text box should be in characters.
     * @param {Form~ExtraFunctions} extra_functions
     *     Functions that can be used to modify the display or behavior of the
     *     form field.
     */
    addTextArea(name, display_name, initial_value, rows, columns, extra_functions={})
    {
        this._values[name] = initial_value;

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

        this._pushField(name,
                        display_name,
                        field_function,
                        Form._FieldOrder.NORMAL,
                        null,
                        extra_functions);
    }

    /**
     * Add a `<input type="file">` field.
     *
     * When the user chooses a file its contents will be read as plain text. The
     * value provided for this field when {@link Form#getValues getValues()} is
     * called will be an object with two keys: "name", the name of the file, and
     * "text", the contents of the file.
     *
     * @param {string} name
     *     The name and id of this field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {Form~ExtraFunctions} extra_functions
     *     Functions that can be used to modify the display or behavior of the
     *     form field.
     */
    addTextFile(name, display_name, extra_functions={})
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
            let attributes = {id:       id,
                              type:     "file",
                              onchange: handler_function};

            if (Form._clear === value)
            {
                attributes.value = "";
            }

            return m("input", attributes);
        }

        this._pushField(name,
                        display_name,
                        field_function,
                        Form._FieldOrder.NORMAL,
                        null,
                        extra_functions);
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
     * Render the form for Mithril.
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
            if (Form._clear === value)
            {
                this._values[field_spec.name] = "";
            }
            value = field_spec.value(value);

            let item_class  = null;
            let field_parts = [ m("label",
                                  {class: "field_name", for: id},
                                  field_spec.display_name),
                                field_spec.field(value, id)];
            if (Form._FieldOrder.REVERSED == field_spec.order)
            {
                item_class = "reversed";
                field_parts.reverse();
            }
            if (field_spec.render_suffix)
            {
                field_parts.push(field_spec.render_suffix());
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
     * Store the specification for a form field.
     *
     * The provided data are used when drawing the form whenever
     * {@link Form#m Form#m()} is called.
     *
     * @param {string} name
     *     The name and id of the form field.
     * @param {string} display_name
     *     The name to display in the `<label>` for the user.
     * @param {Form~_FieldFunction} field_function
     *     The function used to render the field.
     * @param {Form~_FieldOrder} order
     *     The order in which the parts of the field should be drawn.
     * @param {Form~_ValueFunction|null} value_function
     *     An optional function for transforming the stored value for use and
     *     display by the `field_function`.
     * @param {Form~ExtraFunctions} extra_functions
     *     User provided extra functions that can affect the display and
     *     behavior of the form field.
     *
     * @private
     */
    _pushField(name,
               display_name,
               field_function,
               order,
               value_function,
               extra_functions)
    {
        if (!value_function)
        {
            value_function = Form._identity;
        }
        let field_spec = {name:         name,
                          display_name: display_name,
                          field:        field_function,
                          order:        order,
                          value:        value_function};
        if (extra_functions)
        {
            field_spec.render_suffix = extra_functions.render_suffix;
        }

        this._fields.push(field_spec);
    }

    /**
     * A helper function for rendering options for `<select>` elements.
     *
     * **Warning:** To handle `<optgroup>` elements this function is recursive
     * and does not protect against cycles in `options`.
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

    /**
     * An identity function.
     *
     * @param {*} value
     *     The input value, which will be returned.
     *
     * @returns {*}  The exact value passed in the `value` parameter.
     *
     * @private
     */
    static _identity(value)
    {
        return value;
    }
};

export default Form;
