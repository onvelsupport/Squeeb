document.addEventListener("DOMContentLoaded", () => {

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const chatMessages =
        document.getElementById("chatMessages");

    const messageInput =
        document.getElementById("messageInput");

    const messageComposer =
        document.getElementById("messageComposer");

    const sendButton =
        document.getElementById("sendMessageBtn");

    const chatEmpty =
        document.getElementById("chatEmpty");


    let sending = false;


    /* ==========================================================
       SCROLL
    ========================================================== */

    function scrollToLatest() {

        if (!chatMessages) {
            return;
        }


        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    }


    scrollToLatest();



    /* ==========================================================
       AUTO RESIZE TEXTAREA
    ========================================================== */

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



    /* ==========================================================
       BUILD OPTIMISTIC MESSAGE
    ========================================================== */

    function createOptimisticMessage(text) {

        if (!chatMessages) {
            return null;
        }


        chatEmpty?.remove();


        const row =
            document.createElement("div");


        row.className =
            "message-row sent pending";


        const bubble =
            document.createElement("div");


        bubble.className =
            "message-bubble";


        const messageText =
            document.createElement("p");


        /*
         * textContent prevents the user-entered
         * message from becoming HTML.
         */

        messageText.textContent =
            text;


        const messageTime =
            document.createElement("div");


        messageTime.className =
            "message-time";


        const timeText =
            document.createElement("span");


        timeText.textContent =
            "Sending...";


        const icon =
            document.createElement("i");


        icon.className =
            "fa-regular fa-clock";


        messageTime.appendChild(
            timeText
        );


        messageTime.appendChild(
            icon
        );


        bubble.appendChild(
            messageText
        );


        bubble.appendChild(
            messageTime
        );


        row.appendChild(
            bubble
        );


        chatMessages.appendChild(
            row
        );


        scrollToLatest();


        return row;

    }



    /* ==========================================================
       MESSAGE SUCCESS
    ========================================================== */

    function markMessageSent(
        row,
        data
    ) {

        if (!row) {
            return;
        }


        row.classList.remove(
            "pending"
        );


        row.classList.remove(
            "failed"
        );


        if (data?.id) {

            row.dataset.messageId =
                data.id;

        }


        const time =
            row.querySelector(
                ".message-time span"
            );


        if (time) {

            time.textContent =
                data?.created_at ||
                "Just now";

        }


        const icon =
            row.querySelector(
                ".message-time i"
            );


        if (icon) {

            icon.className =
                "fa-solid fa-check";

            icon.title =
                "Sent";

        }

    }



    /* ==========================================================
       MESSAGE FAILED
    ========================================================== */

    function markMessageFailed(
        row
    ) {

        if (!row) {
            return;
        }


        row.classList.remove(
            "pending"
        );


        row.classList.add(
            "failed"
        );


        const time =
            row.querySelector(
                ".message-time span"
            );


        if (time) {

            time.textContent =
                "Failed to send";

        }


        const icon =
            row.querySelector(
                ".message-time i"
            );


        if (icon) {

            icon.className =
                "fa-solid fa-circle-exclamation";

        }

    }



    /* ==========================================================
       SEND MESSAGE
    ========================================================== */

    async function sendMessage() {

        if (
            sending ||
            !messageInput ||
            !messageComposer
        ) {
            return;
        }


        const message =
            messageInput
                .value
                .trim();


        if (!message) {
            return;
        }


        if (message.length > 2000) {

            alert(
                "Your message is too long."
            );

            return;

        }


        /*
         * Clear the input immediately.
         *
         * This makes the chat feel instant.
         */

        messageInput.value =
            "";


        resizeMessageInput();


        const optimisticRow =
            createOptimisticMessage(
                message
            );


        sending =
            true;


        if (sendButton) {

            sendButton.disabled =
                true;

        }


        const csrfToken =
            messageComposer
                .querySelector(
                    "[name='csrfmiddlewaretoken']"
                )
                ?.value;


        const formData =
            new FormData();


        formData.append(
            "message",
            message
        );


        try {

            const response =
                await fetch(
                    messageComposer.action,
                    {
                        method:
                            "POST",

                        credentials:
                            "same-origin",

                        headers: {

                            "X-Requested-With":
                                "XMLHttpRequest",

                            "X-CSRFToken":
                                csrfToken || "",

                            "Accept":
                                "application/json"
                        },

                        body:
                            formData
                    }
                );


            let data = {};


            try {

                data =
                    await response.json();

            } catch {

                data = {};

            }


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to send message."
                );

            }


            markMessageSent(
                optimisticRow,
                data.message
            );


        } catch (error) {

            console.error(
                "MESSAGE SEND ERROR:",
                error
            );


            markMessageFailed(
                optimisticRow
            );


            /*
             * Put the failed message back into
             * the composer so the user doesn't
             * lose what they typed.
             */

            if (
                !messageInput.value.trim()
            ) {

                messageInput.value =
                    message;


                resizeMessageInput();

            }

        } finally {

            sending =
                false;


            if (sendButton) {

                sendButton.disabled =
                    false;

            }


            messageInput.focus();

        }

    }



    /* ==========================================================
       FORM SUBMIT
    ========================================================== */

    messageComposer?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();

        }
    );



    /* ==========================================================
       ENTER SENDS
       SHIFT + ENTER = NEW LINE
    ========================================================== */

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                sendMessage();

            }

        }
    );

});