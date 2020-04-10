class AppError
{
    constructor(message, error_code, source_error="")
    {
        this.message      = message;
        this.error_code   = error_code;
        this.source_error = source_error;
    }

    static weShouldNeverGetHere(message)
    {
        let error = new AppError("Something went wrong, this should have never happened.",
                                 AppError.ERROR_CODE.SHOULD_NEVER_GET_HERE,
                                 message);
        Error.captureStackTrace(error, AppError.weShouldNeverGetHere);

        throw error;
    }


    static isAppError(maybe_an_error)
    {
        return maybe_an_error instanceof AppError;
    }
}

AppError.ERROR_CODE = Object.freeze({
    NO_ERROR:                0,
    UNCAUGHT_EXCEPTION:      1,
    DIR_IS_FILE:             2,
    DIR_CREATION_FAILED:     3,
    SHOULD_NEVER_GET_HERE: 255
});


module.exports = AppError;
