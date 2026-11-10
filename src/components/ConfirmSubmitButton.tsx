'use client';

export default function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
  formAction,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
  // Lets this button submit to a different action than its enclosing <form> - needed wherever
  // this sits inside another form already (e.g. a per-photo delete button inside the product
  // edit form), since HTML doesn't allow a nested <form> to do that instead.
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
