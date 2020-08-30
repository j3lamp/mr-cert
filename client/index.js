"use strict"

import m from "mithril";

const CountryCodes = require("../common/countryCodes");

import Form  from "./form.js"
import Icons from "./icons.js"


const CERT_TYPES = [{type: "root",         name: "CA Roots"},
                    {type: "intermediate", name: "CA Intermediates"},
                    {type: "client",       name: "Client Certificates"}];

function getCertTypeName(search_type)
{
    for (const {type, name} of CERT_TYPES)
    {
        if (type == search_type)
        {
            return name;
        }
    }

    return null;
}


let root  = document.body;
let state = {ready: false};

class Page
{
    view(vnode)
    {
        let nav_content = [];
        for (const {type, name} of CERT_TYPES)
        {
            nav_content.push(m("li", m(m.route.Link, {href: `/${type}`}, name)));
        }

        return [m("header", m("h1", "Mr. Cert")),
                m("nav", m("ul", nav_content)),
                m("div", {class: "content"}, this.content(vnode)),
                m("footer", "The preferred certificate authority of Dark Helmet.")];
    }

    content()
    {
        return "";
    }
};

class Blank extends Page
{
    content()
    {
        return m("div", {class: "empty"}, Icons.certificate());
    }
};


function link(url_base, url_end, link_name, icon = null)
{
    link_name = Icons.addTo(link_name, icon);
    return m(m.route.Link, {href: `${url_base}/${url_end}`}, link_name);
}

function downloadLink(url_base, file_name, link_name, icon=null)
{
    link_name = Icons.addTo(link_name, icon);
    return m("a", {href: `${url_base}/${file_name}`, download: file_name}, link_name);
}

class LoadingPage extends Page
{
    oninit(vnode)
    {
        state = {_ready:  false,
                 _failed: false,
                 _attrs:  vnode.attrs};

        this.request(vnode).then(
            function success()
            {
                state._ready = true;
                m.redraw();
            },
            function failure()
            {
                state._failed = true;
                m.redraw();
            });
    }

    onupdate(vnode)
    {
        if (state._attrs != vnode.attrs)
        {
            // We need to load new data, so we will treat this the same as
            // initialization.
            this.oninit(vnode);
        }
    }

    request()
    {
        return Promise.resolve();
    }

    content(vnode)
    {
        if (state._ready)
        {
            return this.loadedContent(vnode);
        }
        if (state._failed)
        {
            /// @todo Make this nicer.
            return m("strong", 404);
        }
        else
        {
            return m("div",
                     {class: "loading"},
                     Icons.compactDisc({class: "spinner"}));
        }
    }

    loadedContent()
    {
        return "";
    }
};


function getSuperiorTypes(inferior_type)
{
    let superior_types = [];

    for (const {type} of CERT_TYPES)
    {
        if (type == inferior_type)
        {
            break;
        }
        else
        {
            superior_types.push(type);
        }
    }

    return superior_types;
}

class CertList extends LoadingPage
{
    request(vnode)
    {
        let requests = [m.request({method: "GET",
                                   url:    `/api/${vnode.attrs.type}`})
                        .then((data) => {
                            state.certificates = data;
                        })];

        const superior_types = getSuperiorTypes(vnode.attrs.type);
        if (superior_types.length > 0)
        {
            const encoded_types = encodeURIComponent(JSON.stringify(superior_types));
            requests.push(m.request({method: "GET",
                                     url:    `/api/have_certs?types=${encoded_types}`})
                          .then((data) => {
                              state.can_create = data.have_certs;
                          }));
        }
        else
        {
            state.can_create = true;
        }

        return Promise.all(requests);
    }

    loadedContent(vnode)
    {
        const text_route_base = `/${vnode.attrs.type}/text`;
        const file_url_base   = `/files/${vnode.attrs.type}`;

        let certs = [];
        for (const cert_name in state.certificates)
        {
            if (state.certificates.hasOwnProperty(cert_name))
            {
                const properties = state.certificates[cert_name];

                const cert_file = `${cert_name}.crt`;
                const cert = [" ", link(text_route_base,
                                        cert_file,
                                        "View",
                                        "eye"),
                              " ", downloadLink(file_url_base,
                                                cert_file,
                                                "Certificate",
                                                "certificate")];

                let key  = null;
                if (properties.has_key)
                {
                    key = [" ", downloadLink(file_url_base,
                                             `${cert_name}.key`,
                                             "Key",
                                             "key")];
                }

                certs.push(m("li", [cert_name,
                                    m("span", {class: "files"}, [cert, key])]));
            }
        }

        let controls = null;
        if (state.can_create)
        {
            controls = m("nav", m("ul", m("li", link(`/${vnode.attrs.type}`,
                                                     "create-cert",
                                                     "Create Cert",
                                                     "plus"))));
        }

        return m("ul", {class: "cert-list"}, [certs, controls]);
    }
};

class CertText extends LoadingPage
{
    request(vnode)
    {
        const {type, certificate} = vnode.attrs;

        return (m.request({method:       "GET",
                           url:          `api/${type}/text/${certificate}`,
                           responseType: "text"})
                .then((data) => {
                    state.certificate_text = data;
                }));
    }

    loadedContent(vnode)
    {
        if (state.certificate_text)
        {
            return m("pre", state.certificate_text);
        }
        else
        {
            return m("strong", "Error reading the certificate file.");
        }
    }
};

const KEY_LENGTH_OPTIONS = [2048, 4096, 8192];
const DIGEST_ALGORITHM_OPTIONS = ["sha256", "sha384", "sha512"];
const COUNTRY_OPTIONS = (() => {
    let options = [];
    for (const code in CountryCodes)
    {
        options.push({value: code, name: CountryCodes[code]});
    }
    return options;
})();

class CreateRootCert extends LoadingPage
{
    request()
    {
        this.form = new Form("root_cert_form");

        this.form.addInput("name", "Name");
        this.form.addSelect("key_length",
                            ["Key Length ", m("span", {class: "unit"}, "bits")],
                            4096,
                            KEY_LENGTH_OPTIONS);
        this.form.addSelect("digest", "Digest", "sha256", DIGEST_ALGORITHM_OPTIONS);
        this.form.addInput("lifetime",
                           ["Lifetime", m("span", {class: "unit"}, "bits")],
                           365 * 20 + 20 / 4,
                           "number");
        this.form.addSelect("country", "Country", "US", COUNTRY_OPTIONS);
        this.form.addInput("state",               "State");
        this.form.addInput("locality",            "Locality");
        this.form.addInput("organization",        "Organization");
        this.form.addInput("organizational_unit", "Organizational Unit");
        this.form.addInput("email_address",       "E-Mail Address");
        this.form.addInput("common_name",         "Common Name");
        this.form.addCheckbox("intermediate_only",
                              "Only use to sign intermediate certificates",
                              false);

        this.form.setSubmit("Create Certificate",
                            () => { return this.submit(); });

        return Promise.resolve();
    }

    submit()
    {
        try
        {
            let body = this.form.getValues();
            body.key_length = parseInt(body.key_length, 10);

            if (!isNaN(body.key_length))
            {
                state._ready = false;
                m.redraw();

                (m.request({method: "POST",
                            url:    "/root/create-cert-file",
                            body:   body})
                 .then((data) => {
                     m.route.set(`/root/text/${data.new_cert}`);
                 })
                 .catch(() => {
                     /// @todo display an error, ideally something useful...
                     state.ready = true;
                 }));
            }

        }
        finally
        {
            return false;
        }
    }

    loadedContent()
    {
        return this.form.m();
    }
}

class CreateIntermediateCert extends LoadingPage
{
    request(vnode)
    {
        state.signing_certs = {};

        const superior_types = getSuperiorTypes("intermediate");
        const requests = superior_types.map((type) => {
            return (m.request({method: "GET",
                               url:    `/api/${type}`})
                    .then((data) => {
                        state.signing_certs[type] = data;
                    }));
        });

        return (Promise.all(requests)
                .then(() => {
                    this.createForm(state.signing_certs);
                }));
    }

    createForm(signing_certs)
    {
        let signing_options = [];
        for (const type in signing_certs)
        {
            let ca_options = [];
            for (const cert_name in signing_certs[type])
            {
                const value = JSON.stringify({type: type,
                                              name: cert_name});
                ca_options.push({value: value,
                                 name:  cert_name});
            }

            signing_options.push({group:   getCertTypeName(type),
                                  options: ca_options});
        }

        this.form = new Form("intermediate_cert_form");

        this.form.addInput("name", "Name");
        this.form.addSelect("signer", "Signing Certificate", "", signing_options);
        this.form.addSelect("key_length",
                            ["Key Length ", m("span", {class: "unit"}, "bits")],
                            4096,
                            KEY_LENGTH_OPTIONS);
        this.form.addSelect("digest", "Digest", "sha256", DIGEST_ALGORITHM_OPTIONS);
        this.form.addInput("lifetime",
                           ["Lifetime", m("span", {class: "unit"}, "bits")],
                           365 * 5 + 1,
                           "number");
        this.form.addSelect("country", "Country", "US", COUNTRY_OPTIONS);
        this.form.addInput("state",               "State");
        this.form.addInput("locality",            "Locality");
        this.form.addInput("organization",        "Organization");
        this.form.addInput("organizational_unit", "Organizational Unit");
        this.form.addInput("email_address",       "E-Mail Address");
        this.form.addInput("common_name",         "Common Name");

        this.form.setSubmit("Create Certificate",
                            () => { return this.submit(); });
    }

    submit()
    {
        try
        {
            let body = this.form.getValues();
            body.signer     = JSON.parse(body.signer);
            body.key_length = parseInt(body.key_length, 10);

            if (!isNaN(body.key_length))
            {
                state._ready = false;
                m.redraw();

                m.request({method: "POST",
                           url:    "/intermediate/create-cert-file",
                           body:   body})
                    .then((data) => {
                        m.route.set(`/intermediate/text/${data.new_cert}`);
                    })
                    .error(() => {
                        //! @todo display an error, ideally something useful...
                        state.ready = true;
                    });
            }
        }
        finally
        {
            return false;
        }
    }

    loadedContent()
    {
        return this.form.m();
    }
};

class CreateClientCert extends LoadingPage
{
    request(vnode)
    {
        state.form = {
            name:                "",
            signer:              "",
            key_length:          "1024",
            digest:              "sha256",
            lifetime:            825,
            country:             "US",
            state:               "",
            locality:            "",
            organization:        "",
            organizational_unit: "",
            e_mail:              "",
            common_name:         "",
            domain_names:        []
        };

        state.signing_certs = {};

        const superior_types = getSuperiorTypes("client");
        const requests = superior_types.map((type) => {
            return (m.request({method: "GET",
                               url:    `/api/${type}`})
                    .then((data) => {
                        state.signing_certs[type] = data;
                    }));
        })

        return (Promise.all(requests)
                .then(() => {
                    let signing_options = [];
                    for (const type of superior_types)
                    {
                        let ca_options = [];
                        for (const cert_name in state.signing_certs[type])
                        {
                            const value = JSON.stringify({type: type,
                                                          name: cert_name});
                            ca_options.push({value: value,
                                             name:  cert_name});
                        }

                        signing_options.push({group:   getCertTypeName(type),
                                              options: ca_options});
                    }

                    state.signing_certs = signing_options;
                }));
    }

    field(name, input, ...rest)
    {
        return m("li", [m("span", {class: "field_name"}, name), input, ...rest]);
    }

    input(name, type="text")
    {
        let value         = null;
        let handle_change = null;
        if ("number" == type)
        {
            handle_change = function handleNumberChanged(event)
            {
                const new_value = parseInt(event.target.value, 10);
                if (!isNaN(new_value))
                {
                    state.form[name] = new_value;
                }
            }
        }
        else if ("list" == type)
        {
            type = "text";

            value = state.form[name].join(", ");
            handle_change = function handleListChanged(event)
            {
                state.form[name] = event.target.value.split(/[^-.a-zA-Z0-9]+/);
            }
        }
        else
        {
            handle_change = function handleTextChanged(event)
            {
                state.form[name] = event.target.value;
            };
        }

        if (null == value)
        {
            value = state.form[name];
        }

        return m("input",
                 {type:     type,
                  value:    value,
                  onchange: handle_change});
    }

    option(value, name=null, selected=false)
    {
        if (!name)
        {
            name = value;
        }

        return m("option", {value: value, selected: selected}, name);
    }

    makeOptions(options)
    {
        return options.map((option) => {
            if (option.group && option.options)
            {
                return m("optgroup",
                         {label: option.group},
                         this.makeOptions(option.options));
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

    select(name, values)
    {
        return m("select",
                 {value: state.form[name],
                  onchange: (event) => {
                      state.form[name] = event.target.value;
                  }},
                 this.makeOptions(values));
    }

    submitForm()
    {
        try
        {
            let body = {...state.form};
            body.signer     = JSON.parse(state.form.signer);
            body.key_length = parseInt(state.form.key_length, 10);

            if (!isNaN(body.key_length))
            {
                state._ready = false;
                m.redraw();

                m.request({method: "POST",
                           url:    "/client/create-cert-file",
                           body:   body})
                    .then((data) => {
                        m.route.set(`/client/text/${data.new_cert}`);
                    })
                    .error(() => {
                        //! @todo display an error, ideally something useful...
                        state.ready = true;
                    })
            }
        }
        finally
        {
            return false;
        }
    }

    loadedContent(vnode)
    {
        return m("form", {action: "#", onsubmit: ()=>{return false}}, m("ul", [
            this.field("Name", this.input("name")),
            this.field("Signing Certificate Authority",
                       this.select("signer", state.signing_certs)),
            this.field(["Key Length ", m("span", {class: "unit"}, "bits")],
                       this.select("key_length", ["1024",
                                                  "2048",
                                                  "4096"])),
            this.field("Digest Algorithm",
                       this.select("digest", ["sha1",
                                              "sha224",
                                              "sha256",
                                              "sha384",
                                              "sha512"])),
            this.field(["Lifetime ", m("span", {class: "unit"}, "days")],
                       this.input("lifetime", "number"),
                       m("div", {class: "note"}, "Browsers will reject certificates with lifespans longer than 825 days.")),
            this.field("Country",
                       this.select("country", COUNTRY_OPTIONS)),
            this.field("State",               this.input("state")),
            this.field("Locality",            this.input("locality")),
            this.field("Organization",        this.input("organization")),
            this.field("Organizational Unit", this.input("organizational_unit")),
            this.field("E-Mail Address",      this.input("e_mail")),
            this.field("Common Name",         this.input("common_name")),
            this.field("Subject Alternate Domain Names", this.input("domain_names", "list"))
        ]),
                 m("input", {type:    "submit",
                             value:   "Create Certificate",
                             onclick: this.submitForm}))
    }
};


m.route(root, "/", {
    "/":                         Blank,
    "/:type":                    CertList,
    "/:type/text/:certificate":  CertText,
    "/root/create-cert":         CreateRootCert,
    "/intermediate/create-cert": CreateIntermediateCert,
    "/client/create-cert":       CreateClientCert
});
