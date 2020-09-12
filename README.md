Mr. Cert
========

A simple node.js-based certificate authority app that would look great on the
bridge of your spaceship next to Mr. Coffee or
[Mr. Radar](https://spaceballs.fandom.com/wiki/Mr._Radar).

Usage
-----
`node index.js --port <port number> --storage-dir <storage directory> --scratch-dir <scratch directory>`

The storage directory must be writable and will be created if it doesn't exist.
This provides long term storage and should be protected as it will contain the
private keys of the root and intermediate signing certificates.

The scratch directory must be writable and will be created if it doesn't exist.
While this is only used for temporary files please take care as it will contain
the private keys and signing certificates when they are first created.

Warning
-------

This is currently pre-alpha, incomplete software. Only the following features
have been implemented at this time:
 - web interface
 - creation of root signing certificate-key pairs
 - creation of intermediate signing certificate-key pairs
