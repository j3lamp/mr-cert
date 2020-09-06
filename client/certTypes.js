"use strict"
/** @module certTypes */


const SIGNING_CERT_TYPES = [{type: "root",         name: "CA Roots"},
                            {type: "intermediate", name: "CA Intermediates"}];
const LEAF_CERT_TYPES    = [{type: "server",       name: "Server Certificates"},
                            {type: "client",       name: "Client Certificates"}];

/**
 * An object that maps certificate types to their user friendly names.
 */
export const ALL_CERT_TYPES = SIGNING_CERT_TYPES.concat(LEAF_CERT_TYPES);


/**
 * Get the user readable name for a specific certificate type.
 *
 * Note that this only works for types in the ALL_CERT_TYPES object.
 *
 * @param {string} search_type  The certificate type string, e.g. "root".
 *
 * @return {string | null}
 *     The user friendly name for the certificate type, or `null` if the type is
 *     not valid.
 */
export function getCertTypeName(search_type)
{
    for (const {type, name} of ALL_CERT_TYPES)
    {
        if (type == search_type)
        {
            return name;
        }
    }

    return null;
}

/**
 * Get the certificate types that can be used to sign a certificate of a given
 * type.
 *
 * @param {string} type_to_sign  The type of the certificate to be signed.
 *
 * @return {string[]}
 *     The certificate types that can be used to sign a certificate of type
 *     'type_to_sign'.
 */
export function getSigningTypes(type_to_sign)
{
    let signing_types = [];

    for (const {type} of SIGNING_CERT_TYPES)
    {
        if (type == type_to_sign)
        {
            break;
        }
        else
        {
            signing_types.push(type);
        }
    }

    return signing_types;
}

/**
 * Find out if 'search_type' the type of a signing certificate.
 *
 * @param {string} search_type  The certificate type string, e.g. "root".
 *
 * @return {bool}
 *     Returns `true` if the certificate can be used to sign other certificates,
 *     `false` otherwise.
 */
export function isSigningType(search_type)
{
    for (const {type, name} of SIGNING_CERT_TYPES)
    {
        if (type == search_type)
        {
            return true;
        }
    }

    return false;
}
