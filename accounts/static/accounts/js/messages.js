document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* ======================================================
           ELEMENTS
        ====================================================== */

        const chatMessages =
            document.getElementById(
                "chatMessages"
            );


        const messageInput =
            document.getElementById(
                "messageInput"
            );


        const messageComposer =
            document.getElementById(
                "messageComposer"
            );


        const sendButton =
            document.getElementById(
                "sendMessageBtn"
            );


        /* ======================================================
           SCROLL TO NEWEST MESSAGE
        ====================================================== */

        function scrollToLatest() {

            if (!chatMessages) {
                return;
            }


            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }


        scrollToLatest();


        /* ======================================================
           AUTO-GROW TEXTAREA
        ====================================================== */

        function resizeMessageInput() {

            if (!messageInput) {
                return;
            }


            messageInput.style.height =
                "auto";


            messageInput.style.height =
                `${Math.min(
                    messageInput.scrollHeight,
                    130
                )}px`;

        }


        messageInput?.addEventListener(
            "input",
            resizeMessageInput
        );


        /* ======================================================
           ENTER SENDS MESSAGE
           SHIFT + ENTER = NEW LINE
        ====================================================== */

        messageInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                    &&
                    !event.shiftKey
                ) {

                    event.preventDefault();


                    const value =
                        messageInput
                            .value
                            .trim();


                    if (!value) {
                        return;
                    }


                    messageComposer?.requestSubmit();

                }

            }
        );


        /* ======================================================
           PREVENT DOUBLE SEND
        ====================================================== */

        messageComposer?.addEventListener(
            "submit",
            event => {

                const message =
                    messageInput
                        ?.value
                        .trim();


                if (!message) {

                    event.preventDefault();

                    return;

                }


                if (sendButton) {

                    sendButton.disabled =
                        true;


                    sendButton.innerHTML = `
                        <i class="fa-solid fa-spinner fa-spin"></i>
                    `;

                }

            }
        );

    }
);