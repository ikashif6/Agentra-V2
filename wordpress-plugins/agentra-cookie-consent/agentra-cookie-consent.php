<?php
/**
 * Plugin Name:       Agentra Cookie Consent
 * Plugin URI:        https://agentraa.com/cookie-policy/
 * Description:       Cookie banner and preference centre styled for Agentra. Supports necessary, functional, analytics and marketing categories with reopenable Cookie Settings.
 * Version:           1.4.5
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Agentra Technologies (Private) Limited
 * Author URI:        https://agentraa.com
 * License:           Proprietary
 * Text Domain:       agentra-cookie-consent
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'AGENTRA_CC_VERSION', '1.4.5' );
define( 'AGENTRA_CC_NOTICE_VERSION', '2026-07-30' );
define( 'AGENTRA_CC_FILE', __FILE__ );
define( 'AGENTRA_CC_PATH', plugin_dir_path( __FILE__ ) );
define( 'AGENTRA_CC_URL', plugin_dir_url( __FILE__ ) );

/**
 * Create or update the consent audit table.
 */
function agentra_cc_install() {
	global $wpdb;

	$table   = $wpdb->prefix . 'agentra_consent_records';
	$charset = $wpdb->get_charset_collate();

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	dbDelta(
		"CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			consent_id varchar(64) NOT NULL,
			choice_action varchar(32) NOT NULL,
			necessary tinyint(1) NOT NULL DEFAULT 1,
			functional tinyint(1) NOT NULL DEFAULT 0,
			analytics tinyint(1) NOT NULL DEFAULT 0,
			marketing tinyint(1) NOT NULL DEFAULT 0,
			consent_version varchar(32) NOT NULL,
			page_url text NOT NULL,
			user_agent varchar(255) NOT NULL,
			ip_hash char(64) NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY consent_id (consent_id),
			KEY created_at (created_at),
			KEY choice_action (choice_action)
		) {$charset};"
	);

	update_option( 'agentra_cc_db_version', AGENTRA_CC_VERSION, false );
}
register_activation_hook( __FILE__, 'agentra_cc_install' );

/**
 * Run schema upgrades for sites where the plugin was updated while active.
 */
function agentra_cc_maybe_upgrade() {
	if ( AGENTRA_CC_VERSION !== get_option( 'agentra_cc_db_version' ) ) {
		agentra_cc_install();
	}
}
add_action( 'plugins_loaded', 'agentra_cc_maybe_upgrade' );

/**
 * Short-lived same-origin logging token. It is not user authentication.
 *
 * @param string|null $date UTC date, YYYY-MM-DD.
 * @return string
 */
function agentra_cc_log_token( $date = null ) {
	$date = $date ? $date : gmdate( 'Y-m-d' );
	return hash_hmac( 'sha256', 'agentra-cookie-consent|' . $date, wp_salt( 'nonce' ) );
}

/**
 * Default plugin options.
 *
 * @return array
 */
function agentra_cc_default_options() {
	return array(
		'policy_url'         => 'https://agentraa.com/cookie-policy/',
		'privacy_url'        => 'https://agentraa.com/privacy-policy/',
		'banner_title'       => 'We use cookies',
		'banner_text'        => 'We use essential cookies to keep Agentra running securely, plus optional cookies to understand how the site is used and improve your experience. You can change your choice at any time.',
		'reasons'            => "Keeping you signed in and secure\nRemembering your preferences\nRunning live chat and support conversations\nMeasuring performance and fixing errors\nUnderstanding which pages people visit\nMeasuring marketing campaigns",
		'enable_functional'  => 1,
		'enable_analytics'   => 1,
		'enable_marketing'   => 1,
		'consent_days'       => 180,
		'record_days'        => 365,
		'show_on_admin'      => 0,
	);
}

/**
 * Get merged plugin options.
 *
 * @return array
 */
function agentra_cc_get_options() {
	$saved = get_option( 'agentra_cc_options', array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return wp_parse_args( $saved, agentra_cc_default_options() );
}

/**
 * Split the stored reasons textarea into a clean list.
 *
 * @param string $raw Newline separated reasons.
 * @return array
 */
function agentra_cc_reason_lines( $raw ) {
	$lines = preg_split( '/\r\n|\r|\n/', (string) $raw );
	$lines = array_map( 'trim', (array) $lines );
	$lines = array_filter(
		$lines,
		static function ( $line ) {
			return '' !== $line;
		}
	);

	return array_values( $lines );
}

/**
 * Whether the banner should render on this request.
 *
 * @return bool
 */
function agentra_cc_should_render() {
	if ( is_feed() || wp_doing_ajax() || wp_doing_cron() ) {
		return false;
	}

	$options = agentra_cc_get_options();
	if ( is_admin() && empty( $options['show_on_admin'] ) ) {
		return false;
	}

	return true;
}

/**
 * Enqueue front-end assets.
 */
function agentra_cc_enqueue_assets() {
	if ( ! agentra_cc_should_render() ) {
		return;
	}

	$options = agentra_cc_get_options();

	wp_enqueue_script(
		'agentra-cookie-consent',
		AGENTRA_CC_URL . 'assets/js/banner.js',
		array(),
		AGENTRA_CC_VERSION,
		true
	);

	wp_localize_script(
		'agentra-cookie-consent',
		'agentraCookieConsent',
		array(
			'cookieName'       => 'agentra_cookie_consent',
			'consentDays'      => max( 1, absint( $options['consent_days'] ) ),
			'version'          => AGENTRA_CC_VERSION,
			'noticeVersion'    => AGENTRA_CC_NOTICE_VERSION,
			'logUrl'           => admin_url( 'admin-ajax.php' ),
			'logToken'         => agentra_cc_log_token(),
			'cssUrl'           => AGENTRA_CC_URL . 'assets/css/banner.css?ver=' . AGENTRA_CC_VERSION,
			'logoUrl'          => AGENTRA_CC_URL . 'assets/img/agentra-logo.svg?ver=' . AGENTRA_CC_VERSION,
			'policyUrl'        => esc_url( $options['policy_url'] ),
			'privacyUrl'       => esc_url( $options['privacy_url'] ),
			'enableFunctional' => ! empty( $options['enable_functional'] ),
			'enableAnalytics'  => ! empty( $options['enable_analytics'] ),
			'enableMarketing'  => ! empty( $options['enable_marketing'] ),
			'reasons'          => agentra_cc_reason_lines( $options['reasons'] ),
			'i18n'             => array(
				'wordmark'           => __( 'Agentra', 'agentra-cookie-consent' ),
				'title'              => $options['banner_title'],
				'text'               => $options['banner_text'],
				'reasonsTitle'       => __( 'What we use cookies for', 'agentra-cookie-consent' ),
				'acceptAll'          => __( 'Sounds good', 'agentra-cookie-consent' ),
				'rejectOptional'     => __( 'Only essentials', 'agentra-cookie-consent' ),
				'chooseLabel'        => __( 'Let me choose', 'agentra-cookie-consent' ),
				'goBack'             => __( 'Go back', 'agentra-cookie-consent' ),
				'savePreferences'    => __( 'Save my choices', 'agentra-cookie-consent' ),
				'close'              => __( 'Close', 'agentra-cookie-consent' ),
				'necessaryTitle'     => __( 'Strictly necessary', 'agentra-cookie-consent' ),
				'necessaryDesc'      => __( 'Security, sign-in sessions, forms, live chat and your cookie choices.', 'agentra-cookie-consent' ),
				'functionalTitle'    => __( 'Functional', 'agentra-cookie-consent' ),
				'functionalDesc'     => __( 'Remember optional interface, language and display preferences.', 'agentra-cookie-consent' ),
				'analyticsTitle'     => __( 'Analytics', 'agentra-cookie-consent' ),
				'analyticsDesc'      => __( 'Help us understand usage, diagnose errors and improve performance.', 'agentra-cookie-consent' ),
				'marketingTitle'     => __( 'Marketing', 'agentra-cookie-consent' ),
				'marketingDesc'      => __( 'Measure campaigns, referrals and conversions when marketing tools are enabled.', 'agentra-cookie-consent' ),
				'alwaysOn'           => __( 'Always on', 'agentra-cookie-consent' ),
				'learnMore'          => __( 'Cookie Policy', 'agentra-cookie-consent' ),
				'privacyLink'        => __( 'Privacy Policy', 'agentra-cookie-consent' ),
				'reopenLabel'        => __( 'Cookie settings', 'agentra-cookie-consent' ),
			),
		)
	);
}
add_action( 'wp_enqueue_scripts', 'agentra_cc_enqueue_assets' );

/**
 * Set Google Consent Mode defaults before Site Kit / gtag loads.
 * Without this, GA4 cookies can fire before the visitor chooses.
 * If a prior choice exists, restore granted/denied from that cookie immediately.
 */
function agentra_cc_consent_defaults() {
	if ( ! agentra_cc_should_render() ) {
		return;
	}
	?>
	<script>
	(function () {
		window.dataLayer = window.dataLayer || [];
		function gtag(){dataLayer.push(arguments);}
		window.gtag = window.gtag || gtag;

		var analytics = 'denied';
		var marketing = 'denied';
		try {
			var match = document.cookie.match(/(?:^|; )agentra_cookie_consent=([^;]*)/);
			if (match) {
				var saved = JSON.parse(decodeURIComponent(match[1]));
				if (saved && saved.analytics) analytics = 'granted';
				if (saved && saved.marketing) marketing = 'granted';
			}
		} catch (e) {}

		gtag('consent', 'default', {
			analytics_storage: analytics,
			ad_storage: marketing,
			ad_user_data: marketing,
			ad_personalization: marketing,
			wait_for_update: 500
		});
	})();
	</script>
	<?php
}
add_action( 'wp_head', 'agentra_cc_consent_defaults', 1 );

/**
 * Output banner markup in the footer.
 */
function agentra_cc_render_markup() {
	if ( ! agentra_cc_should_render() ) {
		return;
	}
	?>
	<div id="agentra-cc-root" class="agentra-cc" hidden aria-live="polite"></div>
	<?php
}
add_action( 'wp_footer', 'agentra_cc_render_markup', 5 );

/**
 * Shortcode / HTML helper to reopen preferences.
 *
 * Usage: [agentra_cookie_settings]
 * Or any element with class "agentra-cc-open-settings"
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function agentra_cc_settings_shortcode( $atts = array() ) {
	$atts = shortcode_atts(
		array(
			'label' => __( 'Cookie Settings', 'agentra-cookie-consent' ),
			'class' => '',
		),
		$atts,
		'agentra_cookie_settings'
	);

	$class = trim( 'agentra-cc-open-settings ' . $atts['class'] );

	return sprintf(
		'<button type="button" class="%1$s">%2$s</button>',
		esc_attr( $class ),
		esc_html( $atts['label'] )
	);
}
add_shortcode( 'agentra_cookie_settings', 'agentra_cc_settings_shortcode' );

/**
 * Store an explicit consent choice for audit purposes.
 *
 * Records use an anonymous browser-generated ID and a one-way IP hash. Raw IP
 * addresses and account identifiers are not stored.
 */
function agentra_cc_log_consent() {
	$token = isset( $_POST['token'] ) ? sanitize_text_field( wp_unslash( $_POST['token'] ) ) : '';
	$valid = hash_equals( agentra_cc_log_token(), $token )
		|| hash_equals( agentra_cc_log_token( gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ) ), $token );

	if ( ! $valid ) {
		wp_send_json_error( array( 'message' => 'Invalid logging token.' ), 403 );
	}

	$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
	if ( $origin && wp_parse_url( $origin, PHP_URL_HOST ) !== wp_parse_url( home_url(), PHP_URL_HOST ) ) {
		wp_send_json_error( array( 'message' => 'Invalid origin.' ), 403 );
	}

	$remote_ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	$ip_hash   = hash_hmac( 'sha256', $remote_ip, wp_salt( 'auth' ) );
	$rate_key  = 'agentra_cc_rate_' . substr( $ip_hash, 0, 24 );
	$rate      = (int) get_transient( $rate_key );
	if ( $rate >= 30 ) {
		wp_send_json_error( array( 'message' => 'Rate limit reached.' ), 429 );
	}
	set_transient( $rate_key, $rate + 1, HOUR_IN_SECONDS );

	$consent_id = isset( $_POST['consent_id'] ) ? sanitize_text_field( wp_unslash( $_POST['consent_id'] ) ) : '';
	if ( ! preg_match( '/^[a-zA-Z0-9-]{8,64}$/', $consent_id ) ) {
		wp_send_json_error( array( 'message' => 'Invalid consent ID.' ), 400 );
	}

	$allowed_actions = array( 'accept_all', 'essentials_only', 'custom' );
	$choice_action   = isset( $_POST['choice_action'] ) ? sanitize_key( wp_unslash( $_POST['choice_action'] ) ) : '';
	if ( ! in_array( $choice_action, $allowed_actions, true ) ) {
		wp_send_json_error( array( 'message' => 'Invalid consent action.' ), 400 );
	}

	global $wpdb;
	$table  = $wpdb->prefix . 'agentra_consent_records';
	$result = $wpdb->insert(
		$table,
		array(
			'consent_id'     => $consent_id,
			'choice_action'  => $choice_action,
			'necessary'      => 1,
			'functional'     => empty( $_POST['functional'] ) ? 0 : 1,
			'analytics'      => empty( $_POST['analytics'] ) ? 0 : 1,
			'marketing'      => empty( $_POST['marketing'] ) ? 0 : 1,
			'consent_version'=> isset( $_POST['consent_version'] ) ? sanitize_text_field( wp_unslash( $_POST['consent_version'] ) ) : AGENTRA_CC_NOTICE_VERSION,
			'page_url'       => isset( $_POST['page_url'] ) ? esc_url_raw( wp_unslash( $_POST['page_url'] ) ) : '',
			'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '',
			'ip_hash'        => $ip_hash,
			'created_at'     => current_time( 'mysql', true ),
		),
		array( '%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
	);

	if ( false === $result ) {
		wp_send_json_error( array( 'message' => 'Could not store consent record.' ), 500 );
	}

	wp_send_json_success( array( 'recorded' => true ) );
}
add_action( 'wp_ajax_agentra_cc_log_consent', 'agentra_cc_log_consent' );
add_action( 'wp_ajax_nopriv_agentra_cc_log_consent', 'agentra_cc_log_consent' );

/**
 * Register settings.
 */
function agentra_cc_register_settings() {
	register_setting(
		'agentra_cc_settings',
		'agentra_cc_options',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'agentra_cc_sanitize_options',
			'default'           => agentra_cc_default_options(),
		)
	);
}
add_action( 'admin_init', 'agentra_cc_register_settings' );

/**
 * Sanitize options.
 *
 * @param array $input Raw options.
 * @return array
 */
function agentra_cc_sanitize_options( $input ) {
	$defaults = agentra_cc_default_options();
	$output   = $defaults;

	if ( ! is_array( $input ) ) {
		return $output;
	}

	$output['policy_url']        = isset( $input['policy_url'] ) ? esc_url_raw( $input['policy_url'] ) : $defaults['policy_url'];
	$output['privacy_url']       = isset( $input['privacy_url'] ) ? esc_url_raw( $input['privacy_url'] ) : $defaults['privacy_url'];
	$output['banner_title']      = isset( $input['banner_title'] ) ? sanitize_text_field( $input['banner_title'] ) : $defaults['banner_title'];
	$output['banner_text']       = isset( $input['banner_text'] ) ? sanitize_textarea_field( $input['banner_text'] ) : $defaults['banner_text'];
	$output['reasons']           = isset( $input['reasons'] ) ? sanitize_textarea_field( $input['reasons'] ) : $defaults['reasons'];
	$output['enable_functional'] = empty( $input['enable_functional'] ) ? 0 : 1;
	$output['enable_analytics']  = empty( $input['enable_analytics'] ) ? 0 : 1;
	$output['enable_marketing']  = empty( $input['enable_marketing'] ) ? 0 : 1;
	$output['consent_days']      = isset( $input['consent_days'] ) ? max( 1, absint( $input['consent_days'] ) ) : $defaults['consent_days'];
	$output['record_days']       = isset( $input['record_days'] ) ? max( 30, absint( $input['record_days'] ) ) : $defaults['record_days'];
	$output['show_on_admin']     = empty( $input['show_on_admin'] ) ? 0 : 1;

	return $output;
}

/**
 * Admin menu.
 */
function agentra_cc_admin_menu() {
	add_options_page(
		__( 'Agentra Cookie Consent', 'agentra-cookie-consent' ),
		__( 'Cookie Consent', 'agentra-cookie-consent' ),
		'manage_options',
		'agentra-cookie-consent',
		'agentra_cc_render_admin_page'
	);

	add_submenu_page(
		'options-general.php',
		__( 'Consent Records', 'agentra-cookie-consent' ),
		__( 'Consent Records', 'agentra-cookie-consent' ),
		'manage_options',
		'agentra-consent-records',
		'agentra_cc_render_records_page'
	);
}
add_action( 'admin_menu', 'agentra_cc_admin_menu' );

/**
 * Settings page markup.
 */
function agentra_cc_render_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$options = agentra_cc_get_options();
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Agentra Cookie Consent', 'agentra-cookie-consent' ); ?></h1>
		<p><?php esc_html_e( 'Configure the cookie banner shown on your marketing site. Optional scripts should only load after consent — listen for the agentra:consent-updated browser event or check window.AgentraConsent.', 'agentra-cookie-consent' ); ?></p>

		<form method="post" action="options.php">
			<?php settings_fields( 'agentra_cc_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="agentra_cc_banner_title"><?php esc_html_e( 'Banner title', 'agentra-cookie-consent' ); ?></label></th>
					<td><input name="agentra_cc_options[banner_title]" id="agentra_cc_banner_title" type="text" class="regular-text" value="<?php echo esc_attr( $options['banner_title'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_banner_text"><?php esc_html_e( 'Banner text', 'agentra-cookie-consent' ); ?></label></th>
					<td><textarea name="agentra_cc_options[banner_text]" id="agentra_cc_banner_text" class="large-text" rows="4"><?php echo esc_textarea( $options['banner_text'] ); ?></textarea></td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_reasons"><?php esc_html_e( 'Why we use cookies', 'agentra-cookie-consent' ); ?></label></th>
					<td>
						<textarea name="agentra_cc_options[reasons]" id="agentra_cc_reasons" class="large-text" rows="6"><?php echo esc_textarea( $options['reasons'] ); ?></textarea>
						<p class="description"><?php esc_html_e( 'One reason per line. Shown as a bulleted list inside the banner.', 'agentra-cookie-consent' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_policy_url"><?php esc_html_e( 'Cookie Policy URL', 'agentra-cookie-consent' ); ?></label></th>
					<td><input name="agentra_cc_options[policy_url]" id="agentra_cc_policy_url" type="url" class="regular-text" value="<?php echo esc_attr( $options['policy_url'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_privacy_url"><?php esc_html_e( 'Privacy Policy URL', 'agentra-cookie-consent' ); ?></label></th>
					<td><input name="agentra_cc_options[privacy_url]" id="agentra_cc_privacy_url" type="url" class="regular-text" value="<?php echo esc_attr( $options['privacy_url'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Optional categories', 'agentra-cookie-consent' ); ?></th>
					<td>
						<label><input type="checkbox" name="agentra_cc_options[enable_functional]" value="1" <?php checked( ! empty( $options['enable_functional'] ) ); ?>> <?php esc_html_e( 'Functional', 'agentra-cookie-consent' ); ?></label><br>
						<label><input type="checkbox" name="agentra_cc_options[enable_analytics]" value="1" <?php checked( ! empty( $options['enable_analytics'] ) ); ?>> <?php esc_html_e( 'Analytics & performance', 'agentra-cookie-consent' ); ?></label><br>
						<label><input type="checkbox" name="agentra_cc_options[enable_marketing]" value="1" <?php checked( ! empty( $options['enable_marketing'] ) ); ?>> <?php esc_html_e( 'Marketing & advertising', 'agentra-cookie-consent' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_consent_days"><?php esc_html_e( 'Remember consent (days)', 'agentra-cookie-consent' ); ?></label></th>
					<td><input name="agentra_cc_options[consent_days]" id="agentra_cc_consent_days" type="number" min="1" max="730" value="<?php echo esc_attr( $options['consent_days'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row"><label for="agentra_cc_record_days"><?php esc_html_e( 'Keep consent records (days)', 'agentra-cookie-consent' ); ?></label></th>
					<td>
						<input name="agentra_cc_options[record_days]" id="agentra_cc_record_days" type="number" min="30" max="3650" value="<?php echo esc_attr( $options['record_days'] ); ?>">
						<p class="description"><?php esc_html_e( 'Anonymous consent audit records older than this are deleted daily.', 'agentra-cookie-consent' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<hr>
		<h2><?php esc_html_e( 'Footer / reopen link', 'agentra-cookie-consent' ); ?></h2>
		<p><?php esc_html_e( 'Add this shortcode anywhere (footer recommended):', 'agentra-cookie-consent' ); ?></p>
		<code>[agentra_cookie_settings]</code>
		<p><?php esc_html_e( 'Or give any button/link the class:', 'agentra-cookie-consent' ); ?> <code>agentra-cc-open-settings</code></p>

		<h2><?php esc_html_e( 'Developer hook', 'agentra-cookie-consent' ); ?></h2>
		<pre style="background:#f6f7f7;padding:12px;overflow:auto;">window.addEventListener('agentra:consent-updated', function (event) {
  var consent = event.detail; // { necessary, functional, analytics, marketing }
  if (consent.analytics) {
    // load analytics
  }
});

// Current state:
// window.AgentraConsent.get()
</pre>
	</div>
	<?php
}

/**
 * Render the consent audit log.
 */
function agentra_cc_render_records_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	global $wpdb;
	$table    = $wpdb->prefix . 'agentra_consent_records';
	$page     = max( 1, isset( $_GET['paged'] ) ? absint( $_GET['paged'] ) : 1 );
	$per_page = 25;
	$offset   = ( $page - 1 ) * $per_page;
	$filter   = isset( $_GET['choice'] ) ? sanitize_key( wp_unslash( $_GET['choice'] ) ) : '';
	$allowed  = array( 'accept_all', 'essentials_only', 'custom' );
	$where    = '';
	$args     = array();

	if ( in_array( $filter, $allowed, true ) ) {
		$where  = ' WHERE choice_action = %s';
		$args[] = $filter;
	}

	$count_sql = "SELECT COUNT(*) FROM {$table}{$where}";
	$total     = $args
		? (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $args ) )
		: (int) $wpdb->get_var( $count_sql );

	$query = "SELECT * FROM {$table}{$where} ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d";
	$rows  = $wpdb->get_results( $wpdb->prepare( $query, array_merge( $args, array( $per_page, $offset ) ) ) );
	$stats = $wpdb->get_results( "SELECT choice_action, COUNT(*) AS total FROM {$table} GROUP BY choice_action", OBJECT_K );

	$labels = array(
		'accept_all'      => __( 'Sounds good', 'agentra-cookie-consent' ),
		'essentials_only'=> __( 'Only essentials', 'agentra-cookie-consent' ),
		'custom'          => __( 'Custom choices', 'agentra-cookie-consent' ),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Consent Records', 'agentra-cookie-consent' ); ?></h1>
		<p><?php esc_html_e( 'Privacy-safe audit records of explicit cookie choices. IP addresses are stored only as one-way hashes.', 'agentra-cookie-consent' ); ?></p>

		<div style="display:flex;gap:12px;flex-wrap:wrap;margin:18px 0;">
			<?php foreach ( $labels as $key => $label ) : ?>
				<div style="min-width:150px;background:#fff;border:1px solid #dcdcde;border-radius:6px;padding:14px 16px;">
					<div style="color:#646970;font-size:12px;"><?php echo esc_html( $label ); ?></div>
					<strong style="font-size:24px;"><?php echo esc_html( isset( $stats[ $key ] ) ? (int) $stats[ $key ]->total : 0 ); ?></strong>
				</div>
			<?php endforeach; ?>
		</div>

		<form method="get" style="display:flex;gap:8px;align-items:center;margin:12px 0;">
			<input type="hidden" name="page" value="agentra-consent-records">
			<select name="choice">
				<option value=""><?php esc_html_e( 'All choices', 'agentra-cookie-consent' ); ?></option>
				<?php foreach ( $labels as $key => $label ) : ?>
					<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $filter, $key ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?>
			</select>
			<?php submit_button( __( 'Filter', 'agentra-cookie-consent' ), 'secondary', '', false ); ?>
			<a class="button" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=agentra_cc_export_records' ), 'agentra_cc_export' ) ); ?>"><?php esc_html_e( 'Export CSV', 'agentra-cookie-consent' ); ?></a>
		</form>

		<table class="widefat striped">
			<thead>
				<tr>
					<th><?php esc_html_e( 'Time (UTC)', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Choice', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Categories', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Consent ID', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Page', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Version', 'agentra-cookie-consent' ); ?></th>
					<th><?php esc_html_e( 'Browser / IP hash', 'agentra-cookie-consent' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php if ( ! $rows ) : ?>
					<tr><td colspan="7"><?php esc_html_e( 'No consent records yet.', 'agentra-cookie-consent' ); ?></td></tr>
				<?php else : ?>
					<?php foreach ( $rows as $row ) : ?>
						<tr>
							<td style="white-space:nowrap;"><?php echo esc_html( $row->created_at ); ?></td>
							<td><?php echo esc_html( isset( $labels[ $row->choice_action ] ) ? $labels[ $row->choice_action ] : $row->choice_action ); ?></td>
							<td>
								<?php
								echo esc_html(
									sprintf(
										'Necessary: Yes · Functional: %s · Analytics: %s · Marketing: %s',
										$row->functional ? 'Yes' : 'No',
										$row->analytics ? 'Yes' : 'No',
										$row->marketing ? 'Yes' : 'No'
									)
								);
								?>
							</td>
							<td><code title="<?php echo esc_attr( $row->consent_id ); ?>"><?php echo esc_html( substr( $row->consent_id, 0, 12 ) ); ?>…</code></td>
							<td><a href="<?php echo esc_url( $row->page_url ); ?>" target="_blank" rel="noopener"><?php echo esc_html( wp_parse_url( $row->page_url, PHP_URL_PATH ) ?: '/' ); ?></a></td>
							<td><?php echo esc_html( $row->consent_version ); ?></td>
							<td>
								<details>
									<summary><?php esc_html_e( 'View details', 'agentra-cookie-consent' ); ?></summary>
									<div style="max-width:300px;overflow-wrap:anywhere;margin-top:6px;">
										<strong><?php esc_html_e( 'Browser:', 'agentra-cookie-consent' ); ?></strong> <?php echo esc_html( $row->user_agent ); ?><br>
										<strong><?php esc_html_e( 'IP hash:', 'agentra-cookie-consent' ); ?></strong> <code><?php echo esc_html( $row->ip_hash ); ?></code>
									</div>
								</details>
							</td>
						</tr>
					<?php endforeach; ?>
				<?php endif; ?>
			</tbody>
		</table>

		<?php
		$total_pages = (int) ceil( $total / $per_page );
		if ( $total_pages > 1 ) {
			echo '<div class="tablenav"><div class="tablenav-pages">';
			echo wp_kses_post(
				paginate_links(
					array(
						'base'      => add_query_arg( 'paged', '%#%' ),
						'format'    => '',
						'current'   => $page,
						'total'     => $total_pages,
						'prev_text' => '&lsaquo;',
						'next_text' => '&rsaquo;',
					)
				)
			);
			echo '</div></div>';
		}
		?>
	</div>
	<?php
}

/**
 * Export all consent records as CSV.
 */
function agentra_cc_export_records() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to export records.', 'agentra-cookie-consent' ) );
	}
	check_admin_referer( 'agentra_cc_export' );

	global $wpdb;
	$table = $wpdb->prefix . 'agentra_consent_records';
	$rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY created_at DESC", ARRAY_A );

	nocache_headers();
	header( 'Content-Type: text/csv; charset=utf-8' );
	header( 'Content-Disposition: attachment; filename=agentra-consent-records-' . gmdate( 'Y-m-d' ) . '.csv' );

	$output = fopen( 'php://output', 'w' );
	fputcsv( $output, array( 'Time UTC', 'Consent ID', 'Choice', 'Necessary', 'Functional', 'Analytics', 'Marketing', 'Version', 'Page URL', 'Browser', 'IP hash' ) );
	foreach ( $rows as $row ) {
		fputcsv(
			$output,
			array(
				$row['created_at'],
				$row['consent_id'],
				$row['choice_action'],
				$row['necessary'],
				$row['functional'],
				$row['analytics'],
				$row['marketing'],
				$row['consent_version'],
				$row['page_url'],
				$row['user_agent'],
				$row['ip_hash'],
			)
		);
	}
	fclose( $output );
	exit;
}
add_action( 'admin_post_agentra_cc_export_records', 'agentra_cc_export_records' );

/**
 * Delete expired audit records.
 */
function agentra_cc_prune_records() {
	global $wpdb;
	$options = agentra_cc_get_options();
	$days    = max( 30, absint( $options['record_days'] ) );
	$table   = $wpdb->prefix . 'agentra_consent_records';
	$cutoff  = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $cutoff ) );
}
add_action( 'agentra_cc_daily_cleanup', 'agentra_cc_prune_records' );

function agentra_cc_schedule_cleanup() {
	if ( ! wp_next_scheduled( 'agentra_cc_daily_cleanup' ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', 'agentra_cc_daily_cleanup' );
	}
}
add_action( 'init', 'agentra_cc_schedule_cleanup' );

/**
 * Settings link on Plugins page.
 *
 * @param array $links Existing links.
 * @return array
 */
function agentra_cc_plugin_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=agentra-cookie-consent' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'agentra-cookie-consent' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'agentra_cc_plugin_action_links' );
